/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "./dom-tools.js";
import { fetchJSON } from "./fetch-tools.js";

setupPage(document).catch(console.error);

async function setupPage(doc) {
  const siteLd = await getSiteLinkingData();
  const pageLd = getPageLinkingData(doc);

  doc.documentElement.setAttribute("lang", siteLd.inLanguage);

  // Add common metadata (including the title) at the start of the head.
  insertAll(doc.head, doc.head.firstChild, getHeadPrefix(doc, siteLd, pageLd));

  insertAll(doc.head, null, [
    h("link", { rel: "stylesheet", href: "/lib/page.css" })
  ]);

  // Add the page header, unless the document already has one.
  if (!doc.querySelector("body > header")) {
    insertAll(doc.body, doc.body.firstChild, [
      h("header", { class: "page" }, h("h1", {}, siteLd.headline))
    ]);
  }

  // Add the page footer, unless the document already has one.
  if (!doc.querySelector("body > footer")) {
    const copyright = [
      "Copyright \xA9",
      siteLd.copyrightYear,
      siteLd.copyrightHolder.name
    ].join(" ");
    insertAll(doc.body, null, [
      h("footer", { class: "page" }, [
        h("ul", { class: "hdot" }, [
          h("li", {}, copyright),
          h("li", {}, h("a", { href: "/license/" }, "License")),
          h("li", {}, h("a", { href: "/privacy/" }, "Privacy Policy"))
        ])
      ])
    ]);
  }
}

function getPageLinkingData(doc) {
  const script = doc.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent) : {};
}

async function getSiteLinkingData() {
  return fetchJSON("/site.json");
}

function getHeadPrefix(doc, siteLd, pageLd) {
  // Start with basic metadata.
  const headPrefix = [
    h("meta", { charset: "utf-8" }),
    h("meta", {
      name: "viewport",
      content: "width=device-width, initial-scale=1"
    })
  ];

  if (!doc.title) {
    // Build a title from the headline of the page (if defined) and site.
    const title = [pageLd.headline, siteLd.headline].filter(v => v).join(" - ");
    headPrefix.push(h("title", {}, title));
  }

  if (pageLd.description) {
    const content = pageLd.description;
    headPrefix.push(h("meta", { name: "description", content }));
  }
  if (pageLd.keywords) {
    const content = pageLd.keywords;
    headPrefix.push(h("meta", { name: "keywords", content }));
  }
  return headPrefix;
}
