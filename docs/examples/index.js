import { h, insertAll } from "/lib/dom.js";
import { fetchLinkingData, fetchURLs } from "/lib/fetching.js";
import { makeRelative } from "/lib/pathing.js";

main().catch(console.error);

/**
 * @returns {Promise<void>}
 */
async function main() {
  const base = new URL(document.location.href);
  const urls = await fetchURLs(new URL("pages.txt", base));
  const docs = await Promise.all(
    urls.map(
      /**
       * @param {URL} url
       * @returns {Promise<[URL, object]>}
       */
      async url => [url, await fetchLinkingData(url)]
    )
  );

  const target = document.getElementById("examples-list");
  if (target) {
    insertAll(target, null, [
      docs.map(([url, ld]) => {
        const href = makeRelative(url, base);
        return h("li", {}, [
          h("a", { href }, ld.headline),
          h("p", {}, ld.description)
        ]);
      })
    ]);
  }
}
