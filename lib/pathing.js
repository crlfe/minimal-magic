/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

export function getParentDirectories(pathname) {
  const routes = [];
  const parts = pathname.split("/");
  for (let i = 1; i < parts.length; i++) {
    routes.push(parts.slice(0, i).join("/") + "/");
  }
  return routes;
}
