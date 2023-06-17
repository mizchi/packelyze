# packelyze compiler

Experimental Optimizer.

## Goals

1. preprocess module scoped source
2. privide bundler

## TODO

- [ ] Symbol to Function Signature

- Language Service
  - [x] write file in memory
  - [ ] create/delete file in memory 
  - [ ] ranged snapshot creator
- Manipulation
  - [x] Batch rename
  - [ ] rename symbol creator
  - [ ] Rename locals
  - [ ] Rename internal interface
  - [ ] Skip rename for external modules
- Side-effect
  - [ ] find global references
  - [ ] find global mutator
  - [ ] find arguments mutator
  - [ ] find external 
  - [ ] list impure globals
  - [ ] mark pure function
- Transfomer
  - [ ] Rename scoped
  - [ ] Constants Replacement
  - [ ] Dead Code Ellimination
- [ ] Bundler
  - [ ] rollup initial version
  - [ ] Self Hosting bundler