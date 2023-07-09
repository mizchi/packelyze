# packelyze compiler

Experimental Optimizer.

## Goals

1. preprocess module scoped source
2. privide bundler

## TODO

- Language Service
  - [x] write file in memory
  - [x] create/delete file in memory 
  - [ ] ranged snapshot creator
- Mangle
  - [x] Batch rename
  - [x] rename symbol creator
  - [x] Rename locals
  - [x] Rename internal interface
  - [x] Skip rename for external modules
  - [x] FIX: class extends
  - [ ] FIX: abstract class member

- Side-effect
  - [x] find global references
  - [x] find global mutator
  - [ ] find arguments mutator
  - [ ] find external 
  - [ ] list impure globals
  - [ ] mark pure function
