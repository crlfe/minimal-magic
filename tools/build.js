/**
 * @author Chris Wolfe
 * @license Apache-2.0
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
  async start(src) {
    this.browser = await puppeteer.launch();
    this.workerPage = await this.browser.newPage();
    this.workerWindow = await this.workerPage.evaluateHandle("window");

    // TODO(#2): Subscribe to the server's error event.
    this.server = http.createServer(this._createApp(src));
    await new Promise(resolve => {
      this.server.listen(0, "localhost", resolve);
    });

    const sa = this.server.address();
    this.url = new URL(`http://${sa.address}:${sa.port}/`);
  }

  async build(route) {
    const page = await this.browser.newPage();

    // Collect the list of local files successfully loaded by the page.
    const loaded = new Set();
    const baseUrl = this.url.toString();
    page.on("response", req => {
      const url = req.url();
      if (req.ok() && url.startsWith(baseUrl)) {
        let route = url.slice(baseUrl.length - 1);
        if (route.endsWith("/")) {
          route += "index.html";
        }
        loaded.add(route);
      }
    });

    // Use a large and high-resolution viewport so that captured images will
    // look decent everywhere.
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });

    // Trigger the page load and wait for all network requests to finish.
    await page.goto(new URL(route, this.url), {
      timeout: 10000,
      waitUntil: "networkidle0"
    });

    let content = await page.content();
    await page.close();

    content = await this._finalizeHTML(route, content);

    // Remove blank line added by prettier.
    // TODO(#6): Resolve whether this is an upstream bug.
    content = content.replace("</head>\n\n", "</head>\n");

    // Replace non-ASCII characters with their encoded forms.
    content = content.replace(/[^\n\r\t\x20-\x7E]/g, x =>
      entities.encodeHTML(x)
    );

    content = "<!DOCTYPE html>\n" + content;

    return { route, content, loaded };
  }

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
      url: null
    });
  }

  _createApp(src) {
    const app = express();
    app.use(
      transformResponse({
        filter: req => req.url.endsWith("/") || req.url.endsWith(".html"),
        transform: (req, res, content) => {
          return this._prepareHTML(req.url, content.toString());
        }
      })
    );
    app.use(express.static(src));
    app.use("/lib", express.static(path.resolve(__dirname, "..", "lib")));
    return app;
  }

  async _prepareHTML(route, content) {
    return await this.workerPage.evaluate(
      prepareHTMLInBrowser,
      this.workerWindow,
      route,
      content
    );
  }

  async _finalizeHTML(route, content) {
    content = await this.workerPage.evaluate(
      finalizeHTMLInBrowser,
      this.workerWindow,
      route,
      content
    );

    content = prettier.format(content, {
      filepath: route,
      parser: "html"
    });

    return content;
  }
}

export default async function build({ src, out }) {
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

  const files = new Map();

  // Build pages and record any loaded files.
  await Promise.all(
    pages.map(async name => {
      const page = await builder.build("/" + name);
      files.set(page.route, true);
      page.loaded.forEach(file => {
        if (!files.has(file)) {
          files.set(file, false);
        }
      });

      const outFile = path.join(out, page.route);
      await mkdirpPromise(path.dirname(outFile));
      await writeFilePromise(outFile, page.content);
    })
  );

  // Copy files that were loaded from the src directory.
  await Promise.all(
    Array.from(files).map(async ([route, written]) => {
      if (!written) {
        let srcFile;
        if (route.startsWith("/lib/")) {
          srcFile = path.join(__dirname, "..", route);
        } else {
          srcFile = path.join(src, route);
        }
        const outFile = path.join(out, route);
        await mkdirpPromise(path.dirname(outFile));
        await copyFilePromise(srcFile, outFile);
      }
    })
  );

  await builder.stop();
}

function prepareHTMLInBrowser(window, url, content) {
  const { DOMParser } = window;
  const doc = new DOMParser().parseFromString(content, "text/html");

  doc.querySelectorAll("script").forEach(script => {
    // Disable any JavaScript without a data-build attribute.
    if (!script.hasAttribute("data-build")) {
      const type = script.getAttribute("type") || "";
      if (!type || type === "text/javascript" || type === "module") {
        script.setAttribute("type", "text/plain;real-type=" + type);
      }
    }
  });

  return doc.documentElement.outerHTML;
}

function finalizeHTMLInBrowser(window, url, content) {
  const { DOMParser, Node } = window;
  const doc = new DOMParser().parseFromString(content, "text/html");

  doc.querySelectorAll("script").forEach(script => {
    if (script.hasAttribute("data-build")) {
      // TODO(#4): Should we leave an inactive script or comment in the output?
      removeNodeAndWhitespace(script);
    } else {
      const type = script.getAttribute("type");
      const prefix = "text/plain;real-type=";
      if (type.startsWith(prefix)) {
        script.setAttribute("type", type.slice(prefix.length));
      }
    }
  });

  return doc.documentElement.outerHTML;

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
}
