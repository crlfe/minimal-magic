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

const globPromise = util.promisify(glob);
const mkdirpPromise = util.promisify(mkdirp);
const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);

export default async function build({ src, out }) {
  // TODO: Add sanity checks so that we can automatically delete stale files
  // from the output directory.

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

  const { server, url } = await startLocalServer(src);

  const browser = await puppeteer.launch();

  // TODO: May need to limit the number of concurrent pages.
  const outputFiles = new Map();
  await Promise.all(
    pages.map(async name => {
      const route = "/" + name;
      try {
        await compilePage(browser, new URL(route, url), outputFiles);
      } catch (err) {
        console.log(route, err.message);
      }
    })
  );

  await browser.close();
  server.close();

  // Write files to the output directory.
  for (let [route, content] of outputFiles) {
    const outName = path.join(out, route);
    if (content === null) {
      console.log("  copy", route);
      if (route.startsWith("/lib/")) {
        content = await readFilePromise(path.join(__dirname, "..", route));
      } else {
        content = await readFilePromise(path.join(src, route));
      }
    }
    await mkdirpPromise(path.dirname(outName));
    await writeFilePromise(outName, content);
  }
}

async function startLocalServer(src) {
  const app = express();
  app.use(express.static(src));
  app.use("/lib", express.static(path.resolve(__dirname, "..", "lib")));

  // TODO: Need to disable client-side only scripts. Later (in compilePage)
  // we will massage the HTML to disable compile-time scripts and re-enable the
  // client-side scripts.

  // TODO: Subscribe to the server's error event.
  const server = http.createServer(app);
  await new Promise(resolve => {
    server.listen(0, "localhost", resolve);
  });

  const sa = server.address();
  const url = new URL(`http://${sa.address}:${sa.port}/`);

  return { server, url };
}

async function compilePage(browser, url, outputFiles) {
  const baseUrl = new URL("/", url).toString();

  const page = await browser.newPage();
  page.on("console", async msg => {
    // Display console log messages.
    // TODO: Format these better and
    console.log(msg);
  });
  page.on("response", req => {
    const url = req.url();
    if (req.ok() && url.startsWith(baseUrl)) {
      let route = url.slice(baseUrl.length - 1);
      if (route.endsWith("/")) {
        route += "index.html";
      }
      if (!outputFiles.has(route)) {
        outputFiles.set(route, null);
      }
    }
  });

  await page.setViewport({
    width: 1200,
    height: 1024,
    deviceScaleFactor: 2
  });
  await page.goto(url, {
    timeout: 10000,
    waitUntil: "networkidle2"
  });
  await page.evaluate(window => {
    const { document, Node, NodeFilter } = window;

    // Remove build-time scripts.
    // TODO: Should we leave an inactive script or comment in the output?
    document.querySelectorAll("script[data-build]").forEach(script => {
      script.parentNode.removeChild(script);
    });

    removeBlankLines();

    function removeBlankLines() {
      const REJECT_TAGS = new Set(["SCRIPT", "STYLE"]);
      const REJECT_WS = new Set(["pre", "pre-wrap"]);

      const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        { acceptNode }
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        while (
          node.nextSibling &&
          node.nextSibling.nodeType === Node.TEXT_NODE
        ) {
          node.textContent += node.nextSibling.textContent;
          node.parentNode.removeChild(node.nextSibling);
        }

        node.textContent = node.textContent.replace(/\s+\n/g, "\n");
      }

      function acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Entirely ignore special elements like script and style.
          if (REJECT_TAGS.has(node.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Entirely ignore elements with CSS white-space like pre.
          const computed = window.getComputedStyle(node);
          if (REJECT_WS.has(computed["white-space"])) {
            return NodeFilter.FILTER_REJECT;
          }

          // Process the children of other elements.
          return NodeFilter.FILTER_SKIP;
        } else if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        } else {
          return NodeFilter.FILTER_REJECT;
        }
      }
    }
  }, await page.evaluateHandle("window"));

  let content = await page.content();
  await page.close();

  content = prettier.format(content, {
    filepath: url.pathname,
    parser: "html"
  });

  // Remove blank line added by prettier.
  // TODO: Resolve whether this is an upstream bug.
  content = content.replace("</head>\n\n", "</head>\n");

  // Replace non-ASCII characters with their encoded forms.
  content = content.replace(/[^\n\r\t\x20-\x7F]/g, x => entities.encodeHTML(x));

  console.log("  html", url.pathname);
  outputFiles.set(url.pathname, content);
}
