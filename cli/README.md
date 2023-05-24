## Setup

optools analyze -i 

you can not 

### Generate `.d.ts` before bundle

Expected directories

```
src/**/*.ts
_analyzed.json (in .gitignore)
```

Emit `lib/*.d.ts` by tsconfig.json (or put `tsconfig.dts.json`)

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

```json
 "scripts": {
    "analyze": "optools -i lib/index.d.ts -o _analyzed.json"
  },
```

(Add `_analyzed.json` in `.gitignore`)

### Minify with your minifier and _analyzed.json

rollup with @rollup/plugin-terser

```ts
// rollup.config.js
import ts from "rollup-plugin-ts";
import terser from "@rollup/plugin-terser";
import analyzed from "./_analyzed.json" assert { type: "json" };

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [
    ts(),
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

## Hack

with typed fetch to keep external effects

```ts
import type { TypedFetch } from "@mizchi/zero-runtime";

// Export fetch to tell side effects to dts-analyzer
export const fetch = globalThis.fetch as TypedFetch<{
  "https://example.test": {
    "/": {
      methodType: "POST",
      bodyType: {
        // you can keep this xxx
        xxx: number
      }
    }
  }
}>
```