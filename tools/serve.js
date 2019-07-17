/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import liveServer from "live-server";
import path from "path";

/**
 * Runs a development server.
 *
 * @param {object} $0
 * @param {string} $0.src
 * @param {string} $0.host
 * @param {string} $0.port
 */
export default function serve({ src, host, port }) {
  liveServer.start({
    root: src,
    host,
    port: parseInt(port, 10),
    mount: [["/lib", path.resolve(__dirname, "..", "lib")]]
  });
}
