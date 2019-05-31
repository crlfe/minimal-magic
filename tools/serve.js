/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import liveServer from "live-server";
import path from "path";

export default function serve({ src, host, port }) {
  liveServer.start({
    root: src,
    host,
    port,
    mount: [["/lib", path.resolve(__dirname, "..", "lib")]]
  });
}
