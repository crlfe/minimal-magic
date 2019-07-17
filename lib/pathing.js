/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

/**
 * Gets the routes belonging to parent directories.
 *
 * @example
 * // returns ["/", "/foo/", "/bar/"]
 * getParentDirectories("/foo/bar/baz.html")
 *
 * @param {string} pathname
 * @returns {string[]}
 */
export function getParentDirectories(pathname) {
  const routes = [];
  const parts = pathname.split("/");
  for (let i = 1; i < parts.length; i++) {
    routes.push(parts.slice(0, i).join("/") + "/");
  }
  return routes;
}

/**
 * Modifies the document to make all links relative to the base.
 *
 * @param {Document} doc
 * @param {URL} [base]
 * @returns {void}
 */
export function makeLinksRelative(doc, base) {
  const safeBase = base || new URL(document.location.href);
  doc.querySelectorAll("*[src]").forEach(element => {
    const relative = makeRelative(element.getAttribute("src") || "", safeBase);
    element.setAttribute("src", relative);
  });
  doc.querySelectorAll("*[href]").forEach(element => {
    const relative = makeRelative(element.getAttribute("href") || "", safeBase);
    element.setAttribute("href", relative);
  });
  doc.querySelectorAll("*[srcset]").forEach(element => {
    const relative = (element.getAttribute("srcset") || "")
      .split(",")
      .map(item => {
        const abs = item.split(/\s+/)[0];
        const rel = makeRelative(abs, safeBase);
        return rel + item.slice(abs.length);
      })
      .join(",");
    element.setAttribute("srcset", relative);
  });
}

/**
 * Makes a link relative to the base.
 *
 * @param {string | URL} url
 * @param {URL} base
 * @returns {string}
 */
export function makeRelative(url, base) {
  const abs = url instanceof URL ? url : new URL(url, base);
  if (abs.host !== base.host) {
    // Do not modify remote URLs.
    return abs.href;
  }

  const pathParts = abs.pathname.split("/");
  const baseParts = base.pathname.split("/");

  let i = 0;
  for (; i < baseParts.length; i++) {
    if (pathParts[i] !== baseParts[i]) {
      break;
    }
  }

  const dotdots = baseParts.slice(i + 1).map(() => "..");
  return dotdots.concat(pathParts.slice(i)).join("/");
}
