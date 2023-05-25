# optools

Aggressive minifying tools to reduce bundle size.

CAUTION: THIS LIBRARY IS VERY EXPERIMENTAL. USE AT YOUR OWN RISK.

```bash
$ npm install @mizchi/optools -D 
# or use directly
$ npx @mizchi/optools analyze-dts -i lib/index.d.ts
```

## tl;dr

Generate `_analyzed.json` by `lib/index.d.ts`

```
$ npx optools analyze-dts -i lib/index.d.ts -o _analyzed.json
```

and use this.

```ts
import {minify} from "terser";
import analyzed from "./_analyzed.json";

await minify({
  mangle: {
    properties: {
      // keep reserved properties
      reserved: analyzed.reserved,
      // minify everything except reserved!
      regex: /.*/,
    }
  }
})
```

Current `optools analyze-dts` is my first step in minifier using type info. In the future, I will examine more aggressive minification methods not only from the analysis of dts files, but also from the analysis of TypeScript source code.

## What it is

- Optool analyzes public interfaces from `*.d.ts` to use terser mangle properties (by `rollup-plugin-dts`).
- Minify with analyzed reserved properties list by `terser`'s `mangle.properties.reserved` and `mangle.properties.regex: /.*/`

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

If you have side effects, see `HACK: Catch the external effects!`

## How to use - step by step

### Generate `.d.ts` before bundle

Expected directories

```
src/**/*.ts
_analyzed.json (in .gitignore)
```

Emit `lib/*.d.ts` by `tsconfig.json` (or put `tsconfig.dts.json` for this tool)

```jsonc
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib",
    "declaration": true,
    "emitDeclarationOnly": true,
  }
}
```

### Analyze your public interfaces

Run `optools analyzer-dts`

```json
 "scripts": {
    "analyze": "optools analyze-dts -i lib/index.d.ts -o _analyzed.json"
  },
```

(Add `_analyzed.json` in your `.gitignore`)

### Minify with your minifier and _analyzed.json

Use this with terser.

Example with rollup & @rollup/plugin-terser

```ts
// rollup.config.js
import terser from "@rollup/plugin-terser";
import analyzed from "./_analyzed.json" assert { type: "json" };

export default {
  // ...
  plugins: [
    // ...
    terser({
      mangle: {
        properties: {
          regex: /^.*$/,
          reserved: analyzed.reserved
        }
      }
    }
  )],
}
```

vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";

export default defineConfig({
  build: {
    // use terser: because esbuild does not support mangle properties builtins
    minify: "terser",
    terserOptions: {
      mangle: {
        properties: {
          regex: /^.*/,
          reserved: analyzed.reserved,
        },
      },
    },
  },
});
```

## HACK: Catch the external effects!

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

### For react developper

TBD

See [react example](/examples/react-lib) and [with-wite example](/examples/with-vite/)

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

- [ ] Cloudflare Support to check additional builtins
- [ ] TypedFetch example more
- [ ] MSW Examples
- [ ] Keep `function.name` and `class.name` option