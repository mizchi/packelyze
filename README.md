# optools

Aggressive minifying tool by typescript static analyzer.

THIS LIBRARY IS HIGHLY EXPERIMENTAL. USE AT YOUR OWN RISK.

```bash
$ npm install optools -D 
```

## What is it

- `optools` generates `mangle.properties.reserved` for terser by analyzing your `lib/index.d.ts` (or other entrypoint)
- High compression ratio with `mangle.properties.reserved=/^.*/` and `mangle.properties.builtins=true`
- But you should declare your project's internal side effects like `fetch(...)`, `postMessage(...)`
  - you can use with `zero-runtime`(WIP) to catch side-effects.

## Who is it beneficial to?

- Library developper to reduce bundle
- Performance-oriented frontend (for lighthouse today?)
- Developers who are required to reduce build size (third party script developper)

## Benchmarks

TBD

## How to use

```bash
$ npx optools init # optional: generate for lib/index.d.ts
$ npx tsc -p tsconfig.optools.json # generate lib/index.d.ts from src/index.ts
$ npx optools analyze-dts # generate _optools-analyzed.json
```

You can use analyzed result by adding `analyze` step before `build` in `package.json`.

```json
  "scripts": {
    "analyze": "tsc -p tsconfig.optools.json && optools analyze-dts",
    "build": "npm run analyze && <your build commnad>"
  },
```

You can skip `optools init` if you know `optools analyze-dts` requirements blow.

## Manual setup without `optools init`

requirements

- `optools.config.json` is options for `optools analyze-dts`
  - You can skip config file with cli options: example `optools analyze-dts -i lib/index.d.ts -o _analyzed.json -b es -b dom -e react/jsx-runtime`
- `optools analyze-dts` analyzes `lib/index.d.ts` to generate `_optools-analyzed.json`
  - If you already genarete `lib/index.d.ts`, you can omit `tsconfig.optools.json`.

## Configuration: `optools.config.json`

```jsonc
{
  // analyzer entrypoint
  "input": "lib/index.d.ts",
  // analyzed output
  "output": "_optools-analyzed.json",
  // builtins default is ["es", "dom", "worker"]
  "builtins": [
    // ECMAScript default features 
    "es",
    // DOM enviroment
    "dom",
    // Worker environment
    "worker",
    // terser's internal reserved dictionary
    "domprops",
    // well known http headers to keep request headers
    "httpHeaders",
    // node environment
    "node",
    // cloudflare-workers
    "cloudflareWorkers"
  ],
  // WIP: It does not work yet.
  // skip library types by analyze-dts
  "external": [
    "react/jsx-runtime"
  ]
}
```

Safest `builtins` are `["es", "dom", "worker", "domprops", "httpHeaders"]` but it includes many false-positive. For most projects, `["es", "dom"]` works well.

### builtins: node

TODO: This fauture does not work yet.

`optools`'s builtin `node` does not include `process` and `Buffer`.

```ts
// use process and Buffer via static import
import process from "node:process";
import Buffer from "node:buffer";
```

TODO: provide linter

## Use analyzed props with terser

### Example: terser

```ts
import {minify} from "terser";
import analyzed from "./_optools-analyzed.json";

const out = await minify({
  mangle: {
    properties: {
      // genarted reserved includes builtins
      bultins: true,
      // keep reserved properties
      reserved: analyzed.reserved,
      // minify everything except reserved!
      regex: /.*/,
    }
  }
});
// use result
console.log(out.code.length);
```

### Example: vite

```ts
import { defineConfig } from "vite";
import analyzed from "./_optools-analyzed.json";

export default defineConfig({
  build: {
    minify: "terser",
    terserOptions: {
      mangle: {
        properties: {
          builtins: true,
          regex: /^.*/,
          reserved: analyzed.reserved,
        },
      },
    },
  },
});
```

esbuild does not work yet.

## With external libraries without bundle

(This section is not necessary if bundling is being processed)

Now external does not work correctly.

Work arround to tell types

```ts
// src/effects.ts
export * from "./index";

// listup external
import * as _1 from "react";
import * as _2 from "react/jsx-runtime";
export { _1, _2 };
```

and analyze `src/effects.ts` instead of `src/index.ts`

```jsonc
// optools.config.json
{
  "input": "lib/effects.d.ts",
  // ...
}
```

## Restrictions

You can not use optools with ...

- Reflection
  - Eval: `eval(...)` or `const directEval = eval; directEval()`
  - Function: `new Function(...)`
  - `.name`: `class MyClass{}; MyClass.name`, `function f(){}; f.name;`
  - Dynamic properties: `instance[dynamic as any]`
- SideEffect without type declarations
  - `fetch(...)`
  - `postMessage()`

![](https://i.gyazo.com/35c576bebd9c6a938612a10fe352dced.png)

If you have side effects, see below.

## Include external effect types

`optool analyze-dts` can keep ESM interface but can not keep internal effects from intern, like `fetch(...)`.

```ts
// index.ts
export type ExternalEffects = {
  // you can keep this keepMe
  keepMe: number;
}
```

Exported properties from entrypoint will be `reserved`.

### with typed fetch to keep external effects

`@mizchi/zero-runtime` library can declare fetch types.

(But anything is fine as long as you export the type from entrypoint)

```ts
// src/fetch.ts
import type { TypedFetch } from "@mizchi/zero-runtime";
export const fetch = globalThis.fetch as TypedFetch<{
  "https://example.test": {
    "/send": {
      methodType: "POST",
      bodyType: {
        // you can keep this xxx
        xxx: number
      },
      headersType: {
        // you can keep this Content-Type
        "Content-Type": "application/json"
      }
    }
  }
}>;
```

Your entrypoint should include fetch types.

```ts
// add this
export type { fetch } from "./fetch"
```

`optools analyze-dts` will capture `fetch()` properties.

### Check with snapshots

Still worried? You can check mangling result with snapshot testings.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";
import { minify } from "terser";

export default defineConfig({
  plugins: [
    {
      name: "optools safety check",
      enforce: "post",
      async transform(code, id) {
        if (!process.env.OPTOOLS_CHECK) return;
        if (id.endsWith(".js")) {
          const result = await minify(code, {
            compress: false
            mangle: {
              module: true,
              properties: {
                regex: /^.*$/,
                reserved: analyzed.reserved,
              },
            },
          });
          return result.code;
        }
      },
    },
  ],
});
```

Put tests.

```ts
// src/fetch.test.ts
import { expect, test } from "vitest";
import type { JSON$stringifyT } from "@mizchi/zero-runtime";

const stringifyT = JSON.stringify as JSON$stringifyT;

test("keep send body", async () => {
  // In this case, fetch effects types includes `keepMe`
  const body = stringifyT({ keepMe: "hello" });
  expect(body).toMatchSnapshot();
});
```

Run test twice with `OPTOOLS_CHECK`.

```bash
$ pnpm vitest --run # it creates __snapshot__
$ OPTOOLS_CHECK=1 pnpm vitest --run # should match with result with mangling
```

## TODO

- [ ] CI
- [ ] Benchmark
- [x] cli: Analyze with additional ambient files
- [ ] cli: Fix external
- [x] cli: builtins cloudflare-workers
- [x] cli: builtins node
- [x] cli: builtins httpHeaders
- [ ] cli: builtins deno
- [ ] cli: builtins jest
- [ ] cli: Keep `function.name` and `class.name` option
- [ ] zero-runtime: implement `Eff<Operation, Return>`
- [ ] linter: check scope
- [ ] minifier: poc

## WIP: Checkseet for optools users

- [ ] Reflections
  - [ ] `eval`
  - [ ] `new Function`
  - [ ] Unsafe `any` casting
- [ ] SideEffect
  - [ ] fetch
  - [ ] postMessage
- [ ] External libraries
- [ ] Ambient Types
  - [ ] local `.d.ts`

## LICENSE

MIT 