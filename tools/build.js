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
  // TODO(#3): Add sanity checks so that we can automatically delete stale files
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

  // TODO(#1): Need to disable client-side only scripts. Later (in compilePage)
  // we will massage the HTML to disable compile-time scripts and re-enable the
  // client-side scripts.

  // TODO(#2): Subscribe to the server's error event.
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
    // TODO(#2): Format these better!
    console.log(msg);
  });
  page.on("response", res => {
    const url = res.url();
    if (res.ok() && url.startsWith(baseUrl)) {
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
  const window = await page.evaluateHandle("window");
  await page.evaluate(() => {
    const { document, Node, NodeFilter } = window;

    // Remove build-time scripts.
    // TODO(#4): Should we leave an inactive script or comment in the output?
    document.querySelectorAll("script[data-build]").forEach(script => {
      removeNodeAndWhitespace(script);
    });

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
  });

  let content = await page.content();
  await page.close();

  content = prettier.format(content, {
    filepath: url.pathname,
    parser: "html"
  });

  // Remove blank line added by prettier.
  // TODO(#6): Resolve whether this is an upstream bug.
  content = content.replace("</head>\n\n", "</head>\n");

  // Replace non-ASCII characters with their encoded forms.
  content = content.replace(/[^\n\r\t\x20-\x7F]/g, x => entities.encodeHTML(x));

  console.log("  html", url.pathname);
  outputFiles.set(url.pathname, content);
}
