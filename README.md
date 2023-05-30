# optools

Aggressive minifying tools to reduce bundle size with terser.

CAUTION: THIS LIBRARY IS HIGHLY EXPERIMENTAL. USE AT YOUR OWN RISK.

```bash
$ npm install optools -D 
```

## How to use

You can skip `optools init` if you know `optools analyze-dts` requirements blow.

```bash
$ npx optools init # optional: generate for lib/index.d.ts
$ npx tsc -p tsconfig.optools.json # generate lib/index.d.ts from src/index.ts
$ npx optools analyze-dts # generate _optools-analyzed.json
```

You can use analyzed result by adding `analyze` step before build in `package.json`.

```json
  "scripts": {
    "analyze": "tsc -p tsconfig.optools.json && optools analyze-dts",
    "build": "npm run analyze && <your build commnad>"
  },
```

## `optools.config.json`

```jsonc
{
  // entrypoint
  "input": "lib/index.d.ts",
  // analyzed output
  "output": "_optools-analyzed.json",
  // builtins default is ["es", "dom", "worker"]
  "builtins": [
    // ECMAScript default features 
    "es",
    // DOM env
    "dom",
    // Worker env
    "worker",
    // terser's internal reserved dictionary
    "domprops"
  ],
  // skip library types by analyze-dts
  "external": [
    "react/jsx-runtime"
  ]
}
```

## Manual setup without `optools init`

optoools requirements.

- `optools.config.json` is options for `optools analyze-dts`
  - You can skip by cli options: example `optools analyze-dts -i lib/index.d.ts -o _analyzed.json -b es -b dom`
- `optools analyze-dts` analyzes `lib/index.d.ts` to generate `_optools-analyzed.json`
  - If you already genarete `lib/index.d.ts`, you can omit `tsconfig.optools.json`.

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

Caution: esbuild does not work yet.

## Who is it beneficial to?

- Library developper to reduce bundle
- Performance-oriented frontend (for lighthouse today?)
- Developers who are required to reduce build size (third party script developper)
- If you have external effects like `fetch()` and `postMessage`, you need to declare external effect types.

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

- [ ] cli: Analyze with additional ambient files
- [ ] cli: builtins cloudflare-workers
- [ ] cli: builtins node
- [ ] cli: builtins deno
- [ ] cli: builtins jest/mocha
- [ ] MSW Examples
- [ ] Keep `function.name` and `class.name` option

## LICENSE

MIT 