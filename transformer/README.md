# packelyze-transnformer

Experimental typescript minifier


## TODO

- IncrementalLanguageService
  - [ ] ranged snapshot create/updater
  - [ ] with project reference(s)
- Mangle
  - [ ] Skip abstract class member symbols
  - [ ] Mangle with `@internal` leading-trivia comments
  - [ ] Skip mangle with `/* packelyze-ignore */` leading-trivia comments
  - [ ] dynamic import and worker (multiple rootFiles)
  - [ ] Add alert for inferred object initialization without type: `const obj = { v: 1 }`
  - [ ] Mangle inferred object members with safe
- Dead Code Elimination
  - [ ] Delete unused class methods
  - [ ] Delete unused import
  - [ ] Disassemble import as star
  - [ ] Replace `import.meta.env.*`
  - [ ] Replace practically uniquely determined constants: `const Constants = { VALUE: 1 };` or `readonly VALUE: 1`
  - [ ] Delete unreachable nodes: `if (false) {...}`
- Side-effect
  - [ ] find object member mutation
  - [ ] mark pure function as `#__NO_SIDE_EFFECTS__`
