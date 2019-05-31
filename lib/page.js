/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { h, insertAll } from "./dom-tools.js";
import { fetchDocument } from "./fetch-tools.js";

setupPage(document).catch(console.error);

async function setupPage(doc) {
  const siteLd = await getSiteLinkingData();
  const pageLd = getPageLinkingData(doc);
  const isRootPage = /^\/(?:index.html)?$/.test(doc.location.pathname);

  doc.documentElement.setAttribute("lang", siteLd.inLanguage);

  // Add common metadata (including the title) at the start of the head.
  insertAll(doc.head, doc.head.firstChild, getHeadPrefix(doc, siteLd, pageLd));

  insertAll(doc.head, null, [
    h("link", { rel: "stylesheet", href: "/lib/page.css" })
  ]);

  // Add the site header, unless the document already has one.
  if (!doc.querySelector("body > header")) {
    const breadcrumbs = await getBreadcrumbs(doc);
    insertAll(doc.body, doc.body.firstChild, [
      h("header", { class: "site" }, [
        h("img", { src: siteLd.image.contentUrl }),
        h("div", {}, [
          h("h1", {}, siteLd.headline),
          breadcrumbs.length > 0 &&
            h("nav", {}, [
              h("ul", { class: "hslash" }, [
                breadcrumbs.map(crumb =>
                  h("li", {}, h("a", { href: crumb.route }, crumb.name))
                )
              ])
            ])
        ])
      ])
    ]);
  }

  // Add the page header, unless the document already has one.
  if (!isRootPage && !doc.querySelector("main > header")) {
    const main = doc.querySelector("main");
    insertAll(main, main.firstChild, [
      h("header", { class: "page" }, [
        h("h2", {}, pageLd.headline),
        pageLd.datePublished &&
          h("p", { class: "date" }, formatLongDate(pageLd.datePublished))
      ])
    ]);
  }

  // Add the site footer, unless the document already has one.
  if (!doc.querySelector("body > footer")) {
    const copyright = [
      "Copyright \xA9",
      siteLd.copyrightYear,
      siteLd.copyrightHolder.name
    ].join(" ");
    insertAll(doc.body, null, [
      h("footer", { class: "site" }, [
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
  const home = await fetchDocument("/");
  return getPageLinkingData(home);
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

async function getBreadcrumbs(doc) {
  const routes = [];

  let pathname = doc.location.pathname.replace(/\/index.html$/, "/");
  while (pathname.length > 1) {
    pathname = pathname.replace(/[^/]*\/?$/, "");
    routes.push(pathname);
  }

  return Promise.all(
    routes.map(async route => {
      if (route === "/") {
        return { name: "Home", route };
      } else {
        const dest = await fetchDocument(route);
        const destLd = getPageLinkingData(dest);
        return { name: destLd.headline, route };
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
