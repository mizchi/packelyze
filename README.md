# optools

Aggressive minification tools.

THIS LIBRARY IS HIGHLY EXPERIMENTAL. USE AT YOUR OWN RISK.

```bash
$ npm install optools -D 
```

## What is `optools`?

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
  "input": "lib/_eff.d.ts",
  // analyzed output
  "output": "_optools-analyzed.json",
  // predefined builtin reserved for environment
  "builtins": [
    // ECMAScript default features 
    "es",
    // DOM enviroment
    "dom",
    // Worker environment
    "worker",
    // terser's internal reserved dictionary. equivalent to es, dom, worker
    "domprops",
    // well known http headers to keep request headers
    "httpHeaders",
    // node standard modules
    "node",
    // react's JSX interfaces
    "react",
    // cloudflare-workers
    "cloudflareWorkers"
  ],
  // (Optional) emit _bundle.d.ts of entrypoint
  "writeDts": "_bundled.d.ts"
}
```

## Use analyzed `reserved` with terser

### Example: terser

```ts
import { minify } from "terser";
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

## You should know side-effects in your codes

![](https://i.gyazo.com/35c576bebd9c6a938612a10fe352dced.png)

You can notify reserved interfaces by `export` from entrypoint. 

```ts
// src/_eff.ts or src/index.ts
export type ___MyReservedDictionary = {
  foo: any,
  bar: any
}
```

It's a simple way to reserve `foo` and `bar`.

### Enviroment side effects

```ts
// src/types.ts
export type SendPayload = {keepMe: number};

// usage in src/*
const payload: SendPayload = {
  keepMe: 1
};
fetch("/send", {
  method: "POST",
  body: JSON.stringify(payload)
});

// src/_eff.ts or src/index.d.ts to notify type interfaces to optools.
export * from "./types";
```

`keepMe` will be reserved.

Native side-effects are `fetch()`, `postMessage()` and others.

### declare global vars

Your code.

```ts
// MyGlobalVar is declared outside.
console.log(MyGlobalVar.xxxx);
```

You should declare types in `src/*.d.ts`

```ts
declare const MyGlobalVar: {
  xxxx: number;
  yyyy: number;
}
```

`MyGlobalVar`, `xxxx`, `yyyy` will be resereved to touch.

### External Library

```ts
import { foo } from "mylib"; // external on bundle

// You should keep xxx
foo(/* external */, { xxx: 1 })
```

## TODO

- [ ] CI
- [ ] Benchmark
- [ ] cli: builtins deno
- [ ] cli: external
- [ ] cli: Keep `function.name` and `class.name` option
- [ ] cli: `Eff<*>` aggregator
- [ ] linter: check scope
- [ ] minifier: poc

## LICENSE

MIT 