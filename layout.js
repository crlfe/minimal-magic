/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "/lib/dom.js";
import { fetchDocument, fetchLinkingData } from "/lib/fetching.js";
import { getParentDirectories } from "/lib/pathing.js";
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

async function setupPage(doc) {
  const isRootPage = /^\/(?:index.html)?$/.test(doc.location.pathname);

  const ld = getPageLinkingData(doc);
  ld.isPartOf = SITE;

  addHtmlMetadata(doc, ld);

  const cssHref = new URL("layout.css", import.meta.url).pathname;
  insertAll(doc.head, null, [h("link", { rel: "stylesheet", href: cssHref })]);

  if (!doc.querySelector("body > header")) {
    insertAll(doc.body, doc.body.firstChild, await getSiteHeader(doc, ld));
  }

  if (!doc.querySelector("main > header")) {
    const main = doc.querySelector("main");
    insertAll(main, main.firstChild, getPageHeader(doc, ld));
  }

  if (!doc.querySelector("body > footer")) {
    insertAll(doc.body, null, getSiteFooter(doc, ld));
  }
}

function getPageLinkingData(doc) {
  const script = doc.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent) : {};
}

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

function getPageHeader(doc, ld) {
  return h("header", { class: "page" }, [
    h("h2", {}, ld.headline),
    ld.datePublished &&
      h("p", { class: "date" }, formatLongDate(ld.datePublished))
  ]);
}

function getSiteFooter(doc, ld) {
  return h("footer", { class: "site" }, [
    "Copyright \xA9 2019 Chris Wolfe. " +
      "Licensed under the Apache License, Version 2.0"
  ]);
}

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

function formatLongDate(source) {
  return new Date(source).toLocaleDateString("en", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
