# packelyze-transnformer

Experimental typescript minifier

## What it is

`packelyze-transformer` transforms typescript code with LanguageService(that has IDE power).

We focus on what terser `cannot` do.

## Example

TBD

## Features

- Mangle unexported symbol with type analyzer


## How it works

- Mocking local files via `IncrementalLanguageService/Host`
  - Read once from fs, then write to memory
- Traverse exported symbols and its related nodes from root files.
  - `SymbolWalker` (imported from typescript core) walks symbols and types with cache rucursively.
- Traverse external import related nodes.
- Collect mangleable nodes that has no relations to symbols and types for exported symbol, external import or builtin access.
- Apply batch renaming to files

Internal Steps.

- [ ] Analyze function side-effects
- [ ] Analyze class-member references
- [ ] Replace constants
- [ ] Delete dead code like `if (false)`
- [x] Delete unusedLocals / unusedParameters
- [ ] Delete unused class members with treeshake
- [x] Mangle
- [x] Bundle


## TODO

- IncrementalLanguageService
  - ranged snapshot create/update
  - with project reference(s)
- Mangle
  - Mangle with `@internal` leading-trivia comments
  - Skip mangle with `/* packelyze-ignore */` leading-trivia comments
  - dynamic import and worker (multiple rootFiles)
  - Add alert for inferred object initialization without type: `const obj = { v: 1 }`
  - Mangle inferred object members with safe
- Dead Code Elimination
  - Delete unused class methods
  - Delete unused import
  - Disassemble import as star
  - Replace `import.meta.env.*`
  - Replace practically uniquely determined constants: `const Constants = { VALUE: 1 };` or `readonly VALUE: 1`
  - Delete unreachable nodes: `if (false) {...}`
- Side-effect detector
  - find object member mutation
  - mark pure function as `#__NO_SIDE_EFFECTS__`
- Plugin
  - Delegate to other transformer
  - SourceMap

## Related

- https://github.com/fairysword/rollup-plugin-pure-annotation
- https://github.com/nadeesha/ts-prune
- https://github.com/pzavolinsky/ts-unused-exports
