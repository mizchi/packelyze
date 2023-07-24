# packelyze-transnformer

`packelyze-transformer` transforms typescript code with LanguageService(that has IDE power).

We focus on what terser can not do.

## Features

- Mangle unexported symbol with type analyzer

## with vite

```js
import { defineConfig } from "vite";
import { tsMinify } from "packelyze-transformer";

export default defineConfig((config) => ({
  plugins: [
    config.mode === "production" && tsMinify({
      // only ts to minified-ts transform
      // vite's internal esbuild will consume it as ts to js
      preTransformOnly: true,
      // keep module interfaces for vite
      rootFileNames: ["./src/index.ts"],
    })
  ]
}));
```

## API

(WIP)

```ts
import { createMinifier } from "packelyze-transformer";
const minifier = createMinifier(...);

// transform ts in memory
minifier.process();
// get transformed result
const result = minifier.readFile(filePath);
```

## How it works

- Mocking local files via `IncrementalLanguageService/Host`
  - Read once from fs, then write to memory
- Traverse exported symbols and its related nodes from root files.
  - `SymbolWalker` (imported from typescript core) walks symbols and types with cache rucursively.
- Traverse external import related nodes.
- Collect mangleable nodes that has no relations to symbols and types for exported symbol, external import or builtin access.
- Apply batch renaming to files


## Resctriction

- Types consumed as object rest spread (`{...v}`) can not mangle because typescript compiler is unsafe for it.

## TODO for 0.1.0 (publish)

- [ ] Mangle skip with `@internal` leading comments
- [ ] Self hosting
- [ ] Transform kind whitelist
- [ ] Safe symbol builder by SyntaxKind
- [ ] Readable intermediate `CodeAction` for debug
- [ ] Add broken pattern tests
- [ ] object initialization without type: `const obj = { v: 1 }`
- [ ] pure: jsx
- [ ] pure: Promise.resolve
- [ ] test for `typeof`
- [ ] Bug: TypeScript clushed with typescript internal assertings
- [ ] Linter or Checker for mangle

## Icebox


- [ ] Alert detecting duplicated keys for object type intersection
- [ ] DCE: Delete unused class methods
- [ ] DCE: Delete unused import
- [ ] DCE: Disassemble import as star
- [ ] DCE: Replace `import.meta.env.*`
- [ ] DCE: Replace practically uniquely determined constants: `const Constants = { VALUE: 1 };` or `readonly VALUE: 1`
- [ ] DCE: Delete unreachable nodes: `if (false) {...}`
- [ ] SideEffect: mark pure function as `#__NO_SIDE_EFFECT__`
- [ ] SourceMap
- [ ] Watch Mode with vite
- [ ] IncrementalLanguageSevice: ranged snapshot create/update (perf)
- [ ] IncrementalLanguageSevice: with project references
- [ ] Fix: `const v = {...} as Additional; v.additional = 1`;

## Related

- https://github.com/fairysword/rollup-plugin-pure-annotation
- https://github.com/nadeesha/ts-prune
- https://github.com/pzavolinsky/ts-unused-exports
