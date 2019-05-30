#!/usr/bin/env node

"use strict";

/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

process.title = "minimal-magic";

const path = require("path");
const toolsDir = path.resolve(__dirname, "tools");

// Add Babel to support import/export.
require("@babel/register")({
  only: [pathname => pathname.startsWith(toolsDir)],
  plugins: ["@babel/plugin-transform-modules-commonjs"]
});

// Execute the main function allowing async.
Promise.resolve()
  .then(() => require(path.join(toolsDir, "main")).default(process.argv))
  .catch(console.error);
