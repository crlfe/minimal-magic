/**
 * Tools for generating and manipulating the browser DOM.
 *
 * @author Chris Wolfe
 * @license Apache-2.0
 */

export function h(type, attrs, ...children) {
  const refCallbacks = [];

  const e = document.createElement(type);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "#text") {
      e.textContent = value;
    } else if (key === "#html") {
      e.innerHTML = value;
    } else if (value === undefined || value === null || value === false) {
      // Skip undefined, null, and false attributes.
    } else if (typeof value === "function") {
      if (key === "ref") {
        refCallbacks.push(value);
      } else {
        e.addEventListener(key.replace(/^on/i, ""), value, false);
      }
    } else {
      e.setAttribute(key, value);
    }
  }
  if (children) {
    insertAll(e, null, children);
  }
  for (const refCallback of refCallbacks) {
    refCallback(e);
  }
  return e;
}

export function insertAll(target, before, ...values) {
  walk(values);

  function walk(values) {
    for (const value of values) {
      if (!value) {
        // Skip falsey values.
      } else if (typeof value === "string") {
        const node = target.ownerDocument.createTextNode(value);
        target.insertBefore(node, before);
      } else if (isIterable(value)) {
        walk(value);
      } else {
        target.insertBefore(value, before);
      }
    }
  }
}

function isIterable(object) {
  return (
    object !== undefined &&
    object !== null &&
    typeof object[Symbol.iterator] === "function"
  );
}
