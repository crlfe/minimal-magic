/**
 * @author Chris Wolfe
 * @license Apache-2.0
 */

import path from "path";
import liveServer from "live-server";

const HELP_MESSAGE = `\
Usage: minimal-magic <command> ...
Tools for a Website with Minimal Magic

Commands:
  build     Compile a release version of the website
  serve     Start a local development server

For details on a command, try 'minimal-magic <command> --help'.
`;

const BUILD_HELP_MESSAGE = `\
Usage: minimal-magic build [PATH]
Builds a production version of the website
`;

const SERVE_HELP_MESSAGE = `\
Usage: minimal-magic serve [PATH]
Starts a development server for the website

Options:
  --host=HOST
  --port=PORT
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
  const command = argv[2];
  const options = parseArgs(argv.slice(3));
  if (!command) {
    usageError("Expected a command");
  } else if (command === "build") {
    await doBuild(options);
  } else if (command === "serve") {
    await doServe(options);
  } else if (command === "help" || command === "--help") {
    console.log(HELP_MESSAGE);
  } else if (command === "version" || command === "--version") {
    console.log(VERSION_MESSAGE);
  } else {
    usageError(`Unrecognized command ${JSON.stringify(command)}`);
  }
}

async function doBuild(options) {
  if (options.help) {
    console.log(BUILD_HELP_MESSAGE);
  } else if (options._.length > 1) {
    usageError("Expected at most one source directory", "build");
  } else {
    const src = path.resolve(options._[0] || ".");
    delete options._;

    throw new Error("TODO: build is not implemented yet");
  }
}

async function doServe(options) {
  if (options.help) {
    console.log(SERVE_HELP_MESSAGE);
    return;
  }
  if (options._.length > 1) {
    usageError("Expected at most one source directory", "serve");
    return;
  }

  const src = path.resolve(options._[0] || ".");
  delete options._;

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

  liveServer.start({
    root: src,
    host,
    port,
    mount: [["/lib", path.resolve(__dirname, "..", "lib")]]
  });
}

function usageError(message, context) {
  context = ["minimal-magic", context].filter(v => v).join(" ");
  console.error(
    [
      `minimal-magic: ${message}`,
      `Try '${context} --help' for more information.`
    ].join("\n")
  );
  process.exitCode = 2;
}

function parseArgs(args) {
  const options = { _: [] };
  let doneOptions = false;
  for (const arg of args) {
    if (arg === "-") {
      options._.push(arg);
    } else if (arg === "--") {
      ignoreOptions = true;
    } else if (arg.startsWith("-") && !doneOptions) {
      const tail = arg.replace(/^--?/, "");
      const equals = tail.indexOf("=");
      if (equals < 0) {
        options[tail] = true;
      } else {
        options[tail.slice(0, equals)] = tail.slice(equals + 1);
      }
    } else {
      options._.push(arg);
    }
  }
  return options;
}
