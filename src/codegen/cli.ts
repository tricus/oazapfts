#!/usr/bin/env node

import fs from "fs";
import path from "path";
import minimist from "minimist";

import { generateSource, Opts } from "./";

const argv = minimist(process.argv.slice(2), {
  alias: {
    i: "include",
    e: "exclude",
    g: "ignoreHeader",
  },
  boolean: ["optimistic"],
});

async function generate(name: string, spec: string, dest: string, opts: Opts) {
  const code = await generateSource(name, spec, opts);
  if (dest) fs.writeFileSync(dest, code);
  else console.log(code);
}

const { include, exclude, optimistic, ignoreHeader } = argv;
// const [spec, dest] = argv._;
// if (!spec) {
//   console.error(`
//   Usage:
//   oazapfts <spec> [filename]

//   Options:
//   --exclude      | -e <tag to exclude>
//   --include      | -i <tag to include>
//   --ignoreHeader | -g <header to ignore (string or /RegExp/)>
//   --optimistic

//   NOTE for Git Bash users: Git Bash mangles commandline args starting with '/'
//   which affects the --ignoreHeader option.  To fix, do one of the following:
//     Set a shell variable: 'export MSYS_NO_PATHCONV=1', or
//     Set a process variable via 'MSYS_NO_PATHCONV=1' before the command, or
//     Double-up the initial slash:        -g //myregex/     , or
//     Double-quote and prefix with space: -g " /myregexp/"  , or
//     Prefix with escaped space:          -g \\ /myregexp/
//   the command. See:
//     https://github.com/git-for-windows/msys2-runtime/pull/11
//     https://stackoverflow.com/q/28533664/426028
//   `);
//   process.exit(1);
// }

// Sample calls:
// node ./lib/codegen/cli.js \
//   http://api.local.symendinc.com/{token}/swagger/v1/swagger.json  \
//   campaign,config,content,customer,portauthority/jobs,shipyard/messaging \
//   ./out/

const [urlPattern, namesWithAliases, outDir] = argv._;

// urlPattern must be a url pointing to a swagger doc, optionally with some {token} inside to be replaced.
// example:  http://my.host.ext/{token} or https://{token}.host.ext
// namesWithAliases must be a comma-separated list of service names with optional aliases
//   like so:  service1name,service2name,service3name/service3alias
// {token} in urlPattern will be replaced by alias if present, otherwise by name

const services = namesWithAliases.split(",").map((nwa) => {
  const parts = nwa.split("/");
  return { name: parts[0], alias: parts[1] ?? parts[0] };
});

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (let service of services) {
  const spec = urlPattern.replace(/\{.+\}/, service.alias);
  const dest = path.posix.join(outDir, `${service.name}.ts`);
  console.log(`Generating client API for ${service.name}/${service.alias}:`);
  console.log(`${spec} => ${dest}`);
  generate(service.name, spec, dest, {
    include,
    exclude,
    optimistic,
    ignoreHeader: fixIgnoreHeader(ignoreHeader),
  });
}

// generate(spec, dest, {
//   include,
//   exclude,
//   optimistic,
//   ignoreHeader: fixIgnoreHeader(ignoreHeader),
// });

// Support workarounds for Git Bash path mangling: strip leading space or extra slash from /regexp/ string
function fixIgnoreHeader(arg: string | string[] = []) {
  return (Array.isArray(arg) ? arg : [arg]).map((s) =>
    s.startsWith(" /") || s.startsWith("//") ? s.slice(1) : s
  );
}
