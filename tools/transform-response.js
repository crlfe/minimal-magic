/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

// This is loosely based on <https://github.com/expressjs/compression>

export default function transformResponseSetup(options) {
  options = Object.assign({}, options);

  const filterCallback = options.filter;
  const transformCallback = options.transform;

  return function transformResponse(req, res, next) {
    if (filterCallback && !filterCallback(req, res)) {
      next();
      return;
    }

    const oldEnd = res.end.bind(res);

    const chunks = [];
    let ended = false;

    res.write = write;
    res.end = end;
    next();

    function write(chunk, encoding) {
      if (ended) {
        return false;
      }
      addChunk(chunk, encoding);
      return true;
    }

    function end(chunk, encoding) {
      if (ended) {
        return false;
      }
      addChunk(chunk, encoding);
      ended = true;

      let body = Buffer.concat(chunks);
      startTransform(body).catch(err => {
        // TODO: Better error reporting
        console.error(err);
      });

      return true;
    }

    function addChunk(chunk, encoding) {
      if (chunk) {
        chunks.push(Buffer.from(chunk, encoding));
      }
    }

    async function startTransform(content) {
      content = await transformCallback(req, res, content);
      if (content) {
        res.setHeader("Content-Length", Buffer.byteLength(content));
        oldEnd(content);
      } else {
        oldEnd();
      }
    }
  };
}
