/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "./dom.js";

/**
 * Fetches JSON-LD linking data from a document. This returns the first script
 * tag with type="application/ld+json" in the head, or the empty object.
 *
 * @param {Document} doc
 * @returns {object}
 */
export function getLinkingData(doc) {
  const script = doc.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent || "{}") : {};
}

/**
 * Adds standard HTML metadata based on JSON-LD linking data.
 *
 * @param {Document} doc
 * @param {object} ld
 * @returns {void}
 */
export function addHtmlMetadata(doc, ld) {
  if (!doc.doctype) {
    doc.insertBefore(
      doc.implementation.createDocumentType("html", "", ""),
      doc.firstChild
    );
  }

  if (!doc.documentElement.hasAttribute("lang")) {
    const inLanguage = ld.inLanguage || (ld.isPartOf && ld.isPartOf.inLanguage);
    if (inLanguage) {
      doc.documentElement.setAttribute("lang", inLanguage);
    }
  }

  const headPrefix = [
    h("meta", { charset: "utf-8" }),
    h("meta", {
      name: "viewport",
      content: "width=device-width, initial-scale=1"
    }),
    h("title", {}, getTitle(ld))
  ];

  if (ld.description) {
    const content = ld.description;
    headPrefix.push(h("meta", { name: "description", content }));
  }

  if (ld.keywords) {
    const content = ld.keywords;
    headPrefix.push(h("meta", { name: "keywords", content }));
  }

  insertAll(doc.head, doc.head.firstChild, headPrefix);
}

/**
 * Gets a title that combines the page and site headlines.
 *
 * @param {object} ld
 * @returns {string}
 */
function getTitle(ld) {
  const pageTitle = ld.headline;
  const siteTitle = ld.isPartOf && ld.isPartOf.headline;

  if (pageTitle) {
    if (siteTitle && pageTitle !== siteTitle) {
      return `${pageTitle} - ${siteTitle}`;
    } else {
      return pageTitle;
    }
  } else {
    if (siteTitle) {
      return siteTitle;
    } else {
      return "";
    }
  }
}
