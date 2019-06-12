import { h, insertAll } from "/lib/dom.js";
import { fetchLinkingData, fetchURLs } from "/lib/fetching.js";
import { makeRelative } from "/lib/pathing.js";

main().catch(console.error);

async function main() {
  const urls = await fetchURLs(new URL("pages.txt", document.location.href));
  const docs = await Promise.all(
    urls.map(async url => [url, await fetchLinkingData(url)])
  );

  insertAll(document.getElementById("examples-list"), null, [
    docs.map(([url, ld]) => {
      const href = makeRelative(url, document.location);
      return h("li", {}, [
        h("a", { href }, ld.headline),
        h("p", {}, ld.description)
      ]);
    })
  ]);
}
