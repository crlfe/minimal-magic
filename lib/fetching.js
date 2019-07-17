/**
 * Tools for fetching resources.
 *
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import { getLinkingData } from "./metadata.js";

/**
 * Fetches from a URL, throwing if the response is an error.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function fetchCheckResponse(url, options) {
  const response = await fetch(String(url), options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText})`);
  }
  return response;
}

/**
 * Fetches a blob from a URL.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<Blob>}
 */
export async function fetchBlob(url, options) {
  const response = await fetchCheckResponse(url, options);
  return response.blob();
}

/**
 * Fetches text from a URL.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<string>}
 */
export async function fetchText(url, options) {
  const response = await fetchCheckResponse(url, options);
  return response.text();
}

/**
 * Fetches an HTML document from a URL.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<Document>}
 */
export async function fetchDocument(url, options) {
  options = Object.assign({ destination: "document" }, options);
  const text = await fetchText(url, options);
  return new DOMParser().parseFromString(text, "text/html");
}

/**
 * Fetches JSON-LD linking data from a URL. This returns the first script tag
 * with type="application/ld+json" in the document head, or the empty object.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<object>}
 */
export async function fetchLinkingData(url, options) {
  return getLinkingData(await fetchDocument(url, options));
}

/**
 * Fetches a JSON value from a URL.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<object>}
 */
export async function fetchJSON(url, options) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

/**
 * Fetches text lines from a URL.
 *
 * Leading and trailing whitespace will be trimmed. Then empty lines and those
 * beginning with "#" will be skipped.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<string[]>}
 */
export async function fetchLines(url, options) {
  const text = await fetchText(url, options);
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"));
}

/**
 * Fetches a list of URLs from a URL.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @returns {Promise<URL[]>}
 */
export async function fetchURLs(url, options) {
  const lines = await fetchLines(url, options);
  return lines.map(line => new URL(line, url));
}
