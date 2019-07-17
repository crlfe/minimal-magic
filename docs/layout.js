/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "/lib/dom.js";
import { fetchLinkingData } from "/lib/fetching.js";
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
 * Builds the page.
 *
 * @param {Document} doc
 * @returns {Promise<void>}
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
 * Gets JSON-LD linking data from a document.
 *
 * This uses the first script type="application/ld+json" tag in the head.
 *
 * @param {Document} doc
 * @returns {object}
 */
function getPageLinkingData(doc) {
  const script = doc.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent || "{}") : {};
}

/**
 * Generates the site header.
 *
 * @param {Document} doc
 * @param {object} ld
 * @returns {Promise<Element>}
 */
async function getSiteHeader(doc, ld) {
  const site = ld.isPartOf;

  const breadcrumbs = await getBreadcrumbs(doc.location.pathname);
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
 * Generates the page header.
 *
 * @param {Document} doc
 * @param {object} ld
 * @returns {Element}
 */
function getPageHeader(doc, ld) {
  return h("header", { class: "page" }, [
    h("h2", {}, ld.headline),
    ld.datePublished &&
      h("p", { class: "date" }, formatLongDate(ld.datePublished))
  ]);
}

/**
 * Generates the site footer.
 *
 * @param {Document} doc
 * @param {object} ld
 * @returns {Element}
 */
function getSiteFooter(doc, ld) {
  void doc, ld;
  return h("footer", { class: "site" }, [
    "Copyright \xA9 2019 Chris Wolfe. " +
      "Licensed under the Apache License, Version 2.0"
  ]);
}

/**
 * Gets information about parent directories needed to display breadcrumbs.
 *
 * @param {string} pathname
 * @returns {Promise<Array<{name: string, route: string}>>}
 */
async function getBreadcrumbs(pathname) {
  const routes = getParentDirectories(pathname);
  routes.pop();

  return Promise.all(
    routes.map(
      /**
       * @param {string} route
       * @returns {Promise<{name: string, route: string}>}
       */
      async route => {
        if (route === "/") {
          return { name: "Home", route };
        } else {
          const ld = await fetchLinkingData(route);
          return { name: ld.headline, route };
        }
      }
    )
  );
}

/**
 * Formats a date like "July 17, 2019".
 *
 * @param {string} source
 * @returns {string}
 */
function formatLongDate(source) {
  return new Date(source).toLocaleDateString("en", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
