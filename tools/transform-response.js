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

/**
 * @typedef {{
 *     filter?: FilterCallback;
 *     transform?: TransformCallback;
 *   }} Options
 */

// This is loosely based on <https://github.com/expressjs/compression>

import express from "express";

/**
 * @param {Options} options
 */
export default function transformResponseSetup(options) {
  options = Object.assign({}, options);

  const filterCallback = options.filter;
  const transformCallback = options.transform;

  /**
   * @private
   * @param {express.Request} req
   * @param {express.Response} res
   * @param {express.NextFunction} next
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
     * @private
     * @param {Array<any>} args
     */
    function write(...args) {
      if (ended) {
        return false;
      }
      doWrite(args);
      return true;
    }

    /**
     * @private
     * @param {Array<any>} args
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
     * @private
     * @param {Array<any>} args
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
     * @private
     * @param {Buffer} content
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
