/**
 * @author Chris Wolfe
 * @license Apache-2.0
 *
 * @typedef {Window & { DOMParser: any; Node: any; }} WindowExt
 */

import entities from "entities";
import express from "express";
import fs from "fs";
import glob from "glob";
import http from "http";
import mkdirp from "mkdirp";
import path from "path";
import puppeteer from "puppeteer";
import prettier from "prettier";
import util from "util";

import transformResponse from "./transform-response";

const globPromise = util.promisify(glob);
const mkdirpPromise = util.promisify(mkdirp);
const copyFilePromise = util.promisify(fs.copyFile);
const writeFilePromise = util.promisify(fs.writeFile);

class Builder {
  /**
   * @param {string} src
   * @returns {Promise<void>}
   */
  async start(src) {
    this.browser = await puppeteer.launch();
    this.workerPage = await this.browser.newPage();
    this.workerWindow = await this.workerPage.evaluateHandle("window");

    // TODO: Also fail the build on warning and error logs.
    this.workerPage.on("console", msg => {
      console.log(`${src} ${msg.type()}: ${msg.text()}`);
    });

    // TODO(#2): Subscribe to the server's error event.
    const server = http.createServer(this._createApp(src));
    await new Promise(resolve => {
      server.listen(0, "localhost", resolve);
    });

    this.server = server;

    const sa = server.address();
    if (!sa || typeof sa === "string") {
      throw new TypeError("Failed to determine server address");
    }
    this.serverUrl = new URL(`http://${sa.address}:${sa.port}/`);
  }

  /**
   * @typedef {object} BuildResult
   * @property {string} route
   * @property {string} content
   * @property {Array<string>} linked
   */

  /**
   * @param {string} route
   * @returns {Promise<BuildResult>}
   */
  async build(route) {
    if (!this.browser || !this.serverUrl) {
      throw new TypeError("Not started");
    }

    const page = await this.browser.newPage();

    // Use a large and high-resolution viewport so that captured images will
    // look decent everywhere.
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });

    const pageUrl = new URL(route, this.serverUrl);

    // Trigger the page load and wait for all network requests to finish.
    await page.goto(pageUrl.href, {
      timeout: 10000,
      waitUntil: "networkidle0"
    });

    let content = await page.content();
    await page.close();

    let linked;
    ({ content, linked } = await this._finalizeHTML(pageUrl, content));

    // Remove blank line added by prettier.
    // TODO(#6): Resolve whether this is an upstream bug.
    content = content.replace("</head>\n\n", "</head>\n");

    // Replace non-ASCII characters with their encoded forms.
    content = content.replace(/[^\n\r\t\x20-\x7E]/g, x =>
      entities.encodeHTML(x)
    );

    content = "<!DOCTYPE html>\n" + content;

    return { route, content, linked };
  }

  /**
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.workerPage) {
      await this.workerPage.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    if (this.server) {
      this.server.close();
    }

    Object.assign(this, {
      browser: null,
      workerPage: null,
      workerWindow: null,
      server: null,
      serverUrl: null
    });
  }

  /**
   * @private
   * @param {string} src
   * @returns {express.Express}
   */
  _createApp(src) {
    const app = express();
    app.use(
      transformResponse({
        filter: req => req.url.endsWith("/") || req.url.endsWith(".html"),
        transform: async (req, res, content) => {
          return Buffer.from(
            await this._prepareHTML(req.url, content.toString())
          );
        }
      })
    );
    app.use(express.static(src));
    app.use("/lib", express.static(path.resolve(__dirname, "..", "lib")));
    return app;
  }

  /**
   * @private
   * @param {string} route
   * @param {string} content
   * @returns {Promise<string>}
   */
  async _prepareHTML(route, content) {
    if (!this.workerPage || !this.workerWindow) {
      throw new TypeError("Not started");
    }

    return await this.workerPage.evaluate(
      prepareHTMLInBrowser,
      this.workerWindow,
      route,
      content
    );
  }

  /**
   * @private
   * @param {URL} pageUrl
   * @param {string} content
   * @returns {Promise<{content:string, linked: Array<string>}>}
   */
  async _finalizeHTML(pageUrl, content) {
    if (!this.workerPage || !this.workerWindow) {
      throw new TypeError("Not started");
    }

    let linked;
    ({ content, linked } = await this.workerPage.evaluate(
      finalizeHTMLInBrowser,
      this.workerWindow,
      pageUrl.toString(),
      content
    ));

    content = prettier.format(content, {
      filepath: pageUrl.pathname,
      parser: "html"
    });

    return { content, linked };
  }
}

/**
 * @param {object} $0
 * @param {string} $0.src
 * @param {string} $0.out
 * @returns {Promise<void>}
 */
export default async function build({ src, out }) {
  src = path.resolve(src) + "/";
  out = path.resolve(out) + "/";

  if (src.startsWith(out)) {
    console.error(
      "Safety check failed: The output directory contains the source!\n" +
        `  source: ${src}\n` +
        `  output: ${out}\n`
    );
    process.exitCode = 1;
    return;
  }

  const pages = await globPromise("**/*.html", {
    cwd: src,
    nodir: true,
    nosort: true
  });
  if (!pages.length) {
    console.error(`No *.html source files found in ${JSON.stringify(src)}`);
    process.exitCode = 1;
    return;
  }

  const builder = new Builder();
  await builder.start(src);

  // File names relative to either the src or out directories.
  // These do not have a leading slash (routes used in the builder do).
  const files = new Map();

  // Build pages and record any linked files.
  await Promise.all(
    pages.map(async name => {
      const page = await builder.build("/" + name);
      files.set(name, true);

      page.linked.forEach(route => {
        const linkedName = route.slice(1);
        if (!files.has(linkedName)) {
          files.set(linkedName, false);
        }
      });

      console.log("  html", name);
      const outFile = path.join(out, name);
      await mkdirpPromise(path.dirname(outFile));
      await writeFilePromise(outFile, page.content);
    })
  );

  // Copy files from the src directory.
  await Promise.all(
    Array.from(files).map(async ([name, written]) => {
      if (!written) {
        let srcFile;
        if (name.startsWith("lib/")) {
          srcFile = path.join(__dirname, "..", name);
        } else {
          srcFile = path.join(src, name);
        }

        console.log("  copy", name);
        const outFile = path.join(out, name);
        await mkdirpPromise(path.dirname(outFile));
        await copyFilePromise(srcFile, outFile);
      }
    })
  );

  // Warn about unexpected (and possibly stale) files in the out directory.
  // For simplicity this ignores dot-files (like .git) and directories.
  const unknownFiles = (await globPromise("**/*", {
    cwd: out,
    nodir: true,
    nosort: true
  })).filter(file => !files.has(file));
  if (unknownFiles.length) {
    console.warn(
      `The output directory contains some unexpected files:\n` +
        unknownFiles.map(file => `  ${file}\n`).join("")
    );
  }

  await builder.stop();
}

/**
 * @private
 * @param {WindowExt} window
 * @param {string} url
 * @param {string} content
 * @returns {string}
 */
function prepareHTMLInBrowser(window, url, content) {
  const { DOMParser } = window;
  const doc = new DOMParser().parseFromString(content, "text/html");

  doc.querySelectorAll("script").forEach(
    /** @param {Element} script */
    script => {
      // Disable any client-side JavaScript.
      if (!script.hasAttribute("data-build")) {
        const type = script.getAttribute("type") || "";
        if (!type || type === "text/javascript" || type === "module") {
          script.setAttribute("type", "text/plain;real-type=" + type);
        }
      }
    }
  );

  return doc.documentElement.outerHTML;
}

/**
 * @param {WindowExt} window
 * @param {string} pageUrlHref
 * @param {string} content
 * @returns {{content: string, linked: Array<string>}}
 */
function finalizeHTMLInBrowser(window, pageUrlHref, content) {
  const { DOMParser, Node } = window;
  const pageUrl = new URL(pageUrlHref);
  const doc = new DOMParser().parseFromString(content, "text/html");

  // Remove elements with the data-build attribute.
  doc.querySelectorAll("*[data-build]").forEach(
    /** @param {Element} element */
    element => {
      // TODO(#4): Should we leave a comment in the output?
      removeNodeAndWhitespace(element);
    }
  );

  // Re-enable client-side JavaScript.
  doc.querySelectorAll("script").forEach(
    /** @param {Element} script */
    script => {
      const type = script.getAttribute("type") || "";
      const prefix = "text/plain;real-type=";
      if (type.startsWith(prefix)) {
        script.setAttribute("type", type.slice(prefix.length));
      }
    }
  );

  const linked = collectLinksInBrowser(doc);

  return { content: doc.documentElement.outerHTML, linked };

  /**
   * @private
   * @param {Node} node
   * @returns {void}
   */
  function removeNodeAndWhitespace(node) {
    const prev = node.previousSibling;
    if (prev && prev.nodeType === Node.TEXT_NODE) {
      prev.textContent = prev.textContent.replace(/[ \t]*$/, "");
    }

    const next = node.nextSibling;
    if (next && next.nodeType === Node.TEXT_NODE) {
      next.textContent = next.textContent.replace(/^[ \t]*\n/, "");
    }

    node.remove();
  }

  /**
   * @private
   * @param {Document} doc
   * @returns {Array<string>}
   */
  function collectLinksInBrowser(doc) {
    const linked = new Set();

    doc.querySelectorAll("*[href]").forEach(
      /** @param {Element} element */
      element => {
        maybeAddLink(element.getAttribute("href") || "", pageUrl);
      }
    );

    doc.querySelectorAll("*[src]").forEach(
      /** @param {Element} element */
      element => {
        maybeAddLink(element.getAttribute("src") || "", pageUrl);
      }
    );

    doc.querySelectorAll("*[srcset]").forEach(
      /** @param {Element} element */
      element => {
        const parts = (element.getAttribute("srcset") || "").split(",");
        parts.forEach(src => {
          maybeAddLink(src.split(/\s+/)[0], pageUrl);
        });
      }
    );

    /**
     * @private
     * @param {string} relative
     * @param {URL} pageUrl
     * @returns {void}
     */
    function maybeAddLink(relative, pageUrl) {
      const url = new URL(relative, pageUrl);
      if (url.origin === pageUrl.origin) {
        let route = url.pathname;
        if (route.endsWith("/")) {
          route += "index.html";
        }
        linked.add(route);
      }
    }

    // TODO: Other elements?
    // TODO: Check that linked files actually exist (and are not directories).

    // Set can not be serialized in puppeteer so convert to an array.
    return Array.from(linked);
  }
}
