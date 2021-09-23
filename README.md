# 🍻 @tricus/oazapfts

Generate TypeScript clients to tap into OpenAPI servers, for use with [`k6`](https://k6.io).

#

## What's different in this fork?

This fork produces APIs suitable for use with the [`k6`](https://k6.io) load testing tool.

1. `runtime` is modified to use [`k6`'s](https://k6.io) [http library](https://k6.io/docs/javascript-api/k6-http/) for http requests.
   - Use of `aync/Promise` removed
1. `--ignoreHeader` option added to the CLI which allows filtering out of headers via `simple-string-match` or `/regexp with options/i`.
1. Tests are not updated and are therefore presumably largely broken.

#

## Features

- **AST-based**:
  Unlike other code generators `oazapfts` does not use templates to generate code but uses TypeScript's built-in API to generate and pretty-print an abstract syntax tree.
- **Fast**: The cli does not use any of the common Java-based tooling, so the code generation is super fast.
- **Tree-shakeable**: Individually exported functions allow you to bundle only the ones you actually use.
- **Human friendly signatures**: The generated api methods don't leak an HTTP-specific implementation details. For example, all optional parameters are grouped together in one object, no matter whether they end up in the headers, path or query-string.

## Installation

```
npm install @tricus/oazapfts
```

**NOTE:** With version 3.0.0 oazapfts has become a runtime dependency and the generated code does no longer include all the fetch logic.

## Usage

```
oazapfts <spec> [filename]

<spec>: URL or local path of OpenAPI or Swagger doc (json or yml)
<filename>: output path/name for generated .ts file (if omitted, outputs to stdout)

Options:
--exclude | -e <tag to exclude>
--include | -i <tag to include>
--ignoreHeader | -g  <header to ignore (string or /regexp/)>
--optimistic

Options can be specified multiple times.
```

- [`--optimistic`](#OptimisticAPIs) option is detailed [below](#OptimisticAPIs)

Example:

```bash
# Read from url and output to ./my-api.ts
./node_modules/.bin/oazapftfs                         \
    http://my.host.com/my-api/swagger/v1/swagger.json \
    ./my-api.ts                                       \
    --ignoreHeader /X-Api-Key/i
```

[//]: # "NOTE: The excessive spaces and dashes below seem to have been inserted at commit time by some unknown component which seems to enforce that the table header and horizontal rule must have same length as the cell content."

| Note for Git Bash users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git Bash mangles commandline args starting with '/' which affects the --ignoreHeader option. To fix, do one of the following:<br>- Set a shell variable: `export MSYS_NO_PATHCONV=1`, or<br>- Set a process variable by inserting `MSYS_NO_PATHCONV=1` before the command, or<br>- Double-up the initial slash: `-g //myregex/`, or<br>- Double-quote and prefix with space: `-g " /myregexp/"`, or<br>- Prefix with escaped space: `-g \ /myregexp/`<br>See:<br>- https://github.com/git-for-windows/msys2-runtime/pull/11<br>- https://stackoverflow.com/q/28533664/426028 |

## Overriding the defaults

The generated file exports a `defaults` constant that can be used to override the `basePath`, provide a custom `fetch` implementation or to send additional headers with each request:

```ts
import * as api from "./api.ts";
import nodeFetch from "node-fetch";

api.default.basePath = "https://example.com/api";

api.defaults.headers = {
  access_token: "secret",
};

api.defaults.fetch = nodeFetch;
```

## Consuming the generated API

For each operation defined in the spec the generated API will export a function with a name matching the `operationId`. If no id is specified, a reasonable name is generated from the HTTP verb and the path.

The **last argument** of each function is an optional `RequestOpts` object that can be used to pass options to the `fetch` call, for example to pass additional headers or an `AbortSignal` to cancel the request later on.

Each function **returns** a Promise for an `ApiResponse` which is an object with a `status` and a `data` property, holding the HTTP status code and the properly typed data from the response body. Since an operation can return different types depending on the status code, the actual return type is a _union_ of all possible responses, discriminated by their status.

Consider the following code generated from the `petstore.json` example:

```ts
export function getPetById(petId: number, opts?: RequestOpts) {
  return fetchJson<
    | {
        status: 200;
        data: Pet;
      }
    | {
        status: 400;
        data: string;
      }
    | {
        status: 404;
        data: string;
      }
  >(`/pet/${petId}`, {
    ...opts,
  });
}
```

In this case the `data` property is typed as `Pet|string`. We can use a type guard to narrow down the type to `Pet`:

```ts
const res = await api.getPetById(1);
if (res.status === 200) {
  const pet = res.data;
  // pet is properly typed as Pet
}
if (res.status === 404) {
  const message = res.data;
  // message is a string
} else {
  // handle the error
}
```

The above code can be simplified by using the `handle` helper:

```ts
import { handle } from "oazapfts";

await handle(api.getPetById(1), {
  200(pet) {
    // pet is properly typed as Pet
  },
  404(message) {
    // message is as string
  },
});
```

The helper will throw an `HttpError` error for any unhanled status code unless you add a `default` handler:

```ts
await handle(api.getPetById(1), {
  200(pet) {
    // ...
  },
  default(status, data) {
    // handle error
  },
});
```

## <a name="OptimisticAPIs"></a>Optimistic APIs

Instead of handling errors right in place we can also use the `ok` helper:

```ts
import { ok } from "oazapfts";

const pet = await ok(api.getPetById(1));
```

With this pattern `pet` will be typed as `Pet` and a `HttpError` will be thrown in case of an error.

You can even turn your whole API into an optimistic one:

```ts
import { optimistic } from "oazapfts";
import * as rawApi from "./api.ts";

const api = optimistic(rawApi);
const pet = await api.getPetById(1);
```

### CLI

Since version 3.1.0 you can also use the `--optimistic` flag on the command line to generate an optimistic API by default.

## About the name

The name comes from a combination of syllables **oa** (OpenAPI) and **ts** (TypeScript) and is [pronounced 🗣](https://youtu.be/chvb-K95rBE) like the Bavarian _O'zapt'is!_ (it's tapped), the famous words that mark the beginning of the Oktoberfest.

# License

MIT
