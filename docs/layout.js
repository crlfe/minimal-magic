/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "/lib/dom.js";
import { fetchDocument, fetchLinkingData } from "/lib/fetching.js";
import { getParentDirectories, makeLinksRelative } from "/lib/pathing.js";
import { addHtmlMetadata } from "/lib/metadata.js";

const SITE = {
  "@type": "WebSite",
  headline: "Minimal Magic",
  inLanguage: "en",
  copyrightHolder: {
    "@type": "Person",
    name: "Chris Wolfe"
  },
  copyrightYear: 2019
};

setupPage(document).catch(console.error);

/**
 * @param {Document} doc
 */
async function setupPage(doc) {
  const isRootPage = /^\/(?:index.html)?$/.test(doc.location.pathname);

  const ld = getPageLinkingData(doc);
  ld.isPartOf = SITE;

  // Trailing whitespace outside the body will get merged in.
  // Remove it to avoid unexpected blank lines in the document.
  const last = doc.body.lastChild;
  if (last && last.nodeType === Node.TEXT_NODE) {
    last.textContent = (last.textContent || "").replace(/\s+$/, "\n");
  }

  addHtmlMetadata(doc, ld);

  const cssHref = new URL("layout.css", import.meta.url).pathname;
  insertAll(doc.head, null, [h("link", { rel: "stylesheet", href: cssHref })]);

  if (!doc.querySelector("body > header")) {
    insertAll(doc.body, doc.body.firstChild, await getSiteHeader(doc, ld));
  }

  if (!doc.querySelector("main > header") && !isRootPage) {
    const main = doc.querySelector("main");
    if (main) {
      insertAll(main, main.firstChild, getPageHeader(doc, ld));
    }
  }

  if (!doc.querySelector("body > footer")) {
    insertAll(doc.body, null, getSiteFooter(doc, ld));
  }

  makeLinksRelative(doc);
}

/**
 * @param {Document} doc
 */
function getPageLinkingData(doc) {
  const script = doc.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent || "{}") : {};
}

/**
 * @param {Document} doc
 * @param {object} ld
 */
async function getSiteHeader(doc, ld) {
  const site = ld.isPartOf;

  const breadcrumbs = await getBreadcrumbs(doc);
  const breadcrumbNav =
    breadcrumbs.length > 0 &&
    h("nav", {}, [
      h("ul", { class: "hslash" }, [
        breadcrumbs.map(crumb =>
          h("li", {}, h("a", { href: crumb.route }, crumb.name))
        )
      ])
    ]);

  return h("header", { class: "site" }, [
    h("img", { src: "/logo.svg", alt: "" }),
    h("div", {}, [h("h1", {}, site.headline), breadcrumbNav])
  ]);
}

/**
 * @param {Document} doc
 * @param {object} ld
 */
function getPageHeader(doc, ld) {
  return h("header", { class: "page" }, [
    h("h2", {}, ld.headline),
    ld.datePublished &&
      h("p", { class: "date" }, formatLongDate(ld.datePublished))
  ]);
}

/**
 * @param {Document} doc
 * @param {object} ld
 */
function getSiteFooter(doc, ld) {
  return h("footer", { class: "site" }, [
    "Copyright \xA9 2019 Chris Wolfe. " +
      "Licensed under the Apache License, Version 2.0"
  ]);
}

/**
 * @param {Document} doc
 */
async function getBreadcrumbs(doc) {
  const routes = getParentDirectories(doc.location.pathname);
  routes.pop();

  return Promise.all(
    routes.map(async route => {
      if (route === "/") {
        return { name: "Home", route };
      } else {
        const ld = await fetchLinkingData(route);
        return { name: ld.headline, route };
      }
    })
  );
}

/**
 * @param {string} source
 */
function formatLongDate(source) {
  return new Date(source).toLocaleDateString("en", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
