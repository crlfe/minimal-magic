/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

/**
 * @callback FilterCallback
 * @param {express.Request} req
 * @param {express.Response} res
 * @returns {boolean}
 */

/**
 * @callback TransformCallback
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {Buffer} content
 * @returns {Promise<Buffer>}
 */

/**
 * @typedef {{
 *     filter?: FilterCallback;
 *     transform?: TransformCallback;
 *   }} Options
 */

// This is loosely based on <https://github.com/expressjs/compression>

import express from "express";

/**
 * Creates a request handler that transforms content from later handlers.
 *
 * @param {Options} options
 * @returns {express.RequestHandler}
 */
export default function transformResponseSetup(options) {
  options = Object.assign({}, options);

  const filterCallback = options.filter;
  const transformCallback = options.transform;

  /**
   * Transforms content from later handlers.
   *
   * @private
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {express.NextFunction} next
   * @returns {void}
   */
  function transformResponse(req, res, next) {
    if (filterCallback && !filterCallback(req, res)) {
      next();
      return;
    }

    const oldEnd = res.end.bind(res);

    /** @type Array<Buffer> */
    const chunks = [];
    let ended = false;

    res.write = write;
    res.end = end;
    next();

    /**
     * Wraps the Response.write function to buffer content.
     *
     * @private
     * @param {Array<any>} args
     * @returns {boolean}
     */
    function write(...args) {
      if (ended) {
        return false;
      }
      doWrite(args);
      return true;
    }

    /**
     * Wraps the Response.end function to transform content.
     *
     * @private
     * @param {Array<any>} args
     * @returns {boolean}
     */
    function end(...args) {
      if (ended) {
        return false;
      }
      doWrite(args);
      ended = true;

      let body = Buffer.concat(chunks);
      startTransform(body).catch(err => {
        // TODO: Better error reporting
        console.error(err);
      });
      return true;
    }

    /**
     * Adds data to the buffered content.
     *
     * @private
     * @param {Array<any>} args
     * @returns {void}
     */
    function doWrite(args) {
      const chunk = args.shift();
      const encoding = typeof args[0] === "string" ? args.shift() : undefined;
      const callback = typeof args[0] === "function" ? args.shift() : undefined;

      if (chunk === null || chunk === undefined) {
        // Nothing to do.
      } else if (Buffer.isBuffer(chunk)) {
        chunks.push(Buffer.from(chunk));
      } else if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, encoding));
      } else {
        throw new TypeError("Expected a buffer or string chunk.");
      }

      if (callback) {
        callback();
      }
    }

    /**
     * Transforms the buffered content and passes it to the response.
     *
     * @private
     * @param {Buffer} content
     * @returns {Promise<void>}
     */
    async function startTransform(content) {
      if (transformCallback) {
        const transformed = await transformCallback(req, res, content);
        if (transformed) {
          res.setHeader("Content-Length", Buffer.byteLength(transformed));
          oldEnd(transformed);
          return;
        }
      }
      oldEnd();
    }
  }

  return transformResponse;
}
