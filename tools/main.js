/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import util from "util";

import buildCommand from "./build";
import serveCommand from "./serve";

const mkdirpPromise = util.promisify(mkdirp);

const HELP_MESSAGE = `\
Usage: minimal-magic <command> ...
Tools for a Website with Minimal Magic

Commands:
  build     Compile a release version of the website.
  serve     Start a local development server.

  help      Display this information, then exit.
  version   Display version and licensing information, then exit.

For details on a command, try 'minimal-magic <command> --help'.
`;

const BUILD_HELP_MESSAGE = `\
Usage: minimal-magic build [OPTION]... [SRC]
Builds a production version of the website in SRC (default "./src")

Options:
  --out=PATH    (default "./out")
`;

const SERVE_HELP_MESSAGE = `\
Usage: minimal-magic serve [OPTION]... [SRC]
Starts a development server for the website in SRC (default "./src")

Options:
  --host=HOST    (default localhost)
  --port=PORT    (default 8080)
`;

const VERSION_MESSAGE = `\
minimal-magic 0.1.0
Tools for a Website with Minimal Magic
Copyright 2019 Chris Wolfe

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this work except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, work
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`;

export default async function main(argv) {
  const usageError = genericUsageError.bind(null, ["minimal-magic"]);

  const [options, operands] = parseArgs(argv.slice(2));
  const command = operands.shift();

  if (command === "help" || (!command && options.help)) {
    console.log(HELP_MESSAGE);
  } else if (command === "version" || (!command && options.version)) {
    console.log(VERSION_MESSAGE);
  } else if (!command) {
    usageError("Expected a command");
  } else if (command === "build") {
    await doBuild(options, operands);
  } else if (command === "serve") {
    await doServe(options, operands);
  } else {
    usageError(`Unrecognized command ${JSON.stringify(command)}`);
  }
}

async function doBuild(options, operands) {
  const usageError = genericUsageError.bind(null, ["minimal-magic", "build"]);

  if (options.help) {
    console.log(BUILD_HELP_MESSAGE);
    return;
  }

  if (operands.length > 1) {
    usageError("Expected at most one source directory");
    return;
  }

  const src = path.resolve(operands[0] || "./src");
  if (!checkSourceDirectory(src, { usageError, fatalError })) {
    return;
  }

  let { out, ...unknown } = options;
  if (Object.keys(unknown).length > 0) {
    const name = Object.keys(unknown)[0];
    usageError(`Unrecognized option ${JSON.stringify(name)}`);
    return;
  }

  out = path.resolve(out || "./out");
  if (!ensureOutputDirectory(out, { usageError, fatalError })) {
    return;
  }

  await buildCommand({ src, out });
}

async function doServe(options, operands) {
  const usageError = genericUsageError.bind(null, ["minimal-magic", "serve"]);

  if (options.help) {
    console.log(SERVE_HELP_MESSAGE);
    return;
  }

  if (operands.length > 1) {
    usageError("Expected at most one source directory");
    return;
  }

  const src = path.resolve(operands[0] || "./src");
  if (!checkSourceDirectory(src, { usageError, fatalError })) {
    return;
  }

  let { host, port, ...unknown } = options;
  if (Object.keys(unknown).length > 0) {
    const name = Object.keys(unknown)[0];
    usageError(`Unrecognized option ${JSON.stringify(name)}`);
    return;
  }

  if (!host) {
    host = "localhost";
  }
  if (!port) {
    port = "8080";
  }

  await serveCommand({ src, host, port });
}

function genericUsageError(context, message) {
  console.error(
    [
      `${context.join(" ")}: ${message}`,
      `Try '${context.join(" ")} --help' for more information.`
    ].join("\n")
  );
  process.exitCode = 2;
}

function fatalError(message, err) {
  console.error(message + ":\n  " + err.message.replace(/\n/g, "\n  "));
  process.exitCode = 1;
}

function checkSourceDirectory(src, { usageError, fatalError }) {
  try {
    const srcStats = fs.statSync(src);
    if (!srcStats.isDirectory()) {
      usageError(`Expected source ${JSON.stringify(src)} to be a directory`);
      return false;
    }
    return true;
  } catch (err) {
    if (err.code === "ENOENT") {
      usageError(`Missing source directory ${JSON.stringify(src)}`);
      return false;
    } else {
      fatalError(
        `Failed to read from source directory ${JSON.stringify(src)}`,
        err
      );
      return false;
    }
  }
}

async function ensureOutputDirectory(out, { usageError, fatalError }) {
  try {
    const outStats = fs.statSync(out);
    if (!outStats.isDirectory()) {
      usageError(`Expected output ${JSON.stringify(out)} to be a directory`);
      return false;
    }
    return true;
  } catch (err) {
    if (err.code === "ENOENT") {
      try {
        await mkdirpPromise(out);
      } catch (err) {
        fatalError(
          `Failed to create output directory ${JSON.stringify(out)}`,
          err
        );
        return false;
      }
      return true;
    } else {
      fatalError(
        `Failed to write to output directory ${JSON.stringify(out)}`,
        err
      );
      return false;
    }
  }
}

function parseArgs(args) {
  const options = {};
  const operands = [];

  let doneOptions = false;
  for (const arg of args) {
    if (arg === "-") {
      operands.push(arg);
    } else if (arg === "--") {
      doneOptions = true;
    } else if (arg.startsWith("-") && !doneOptions) {
      const tail = arg.replace(/^--?/, "");
      const equals = tail.indexOf("=");
      if (equals < 0) {
        options[tail] = true;
      } else {
        options[tail.slice(0, equals)] = tail.slice(equals + 1);
      }
    } else {
      operands.push(arg);
    }
  }
  return [options, operands];
}
