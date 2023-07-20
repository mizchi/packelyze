// types
export type {
  TsMinifyOptions,
  Minifier,
} from "./types";
export type {
  IncrementalLanguageService,
  IncrementalLanguageServiceHost,
} from "./typescript/services";

// instances
export {
  createIncrementalLanguageServiceHost,
  createIncrementalLanguageService,
} from "./typescript/services";
export { createMinifier } from "./minifier";
export { getPlugin as tsMinify } from "./rollup";

// ---- to keep internal interfaces ---
export type { ReadableSymbol, ReadbleNode } from "./typescript/utils";
export type {
  MappedType,
  AnonymousType,
  TypeWithId,
  SymbolWithId,
  BatchRenameLocation,
  // TODO: Remove it
  SymbolWalker,
  SymbolWalkerResult,
} from "./typescript/types";

// TODO: Remove these
export type { FileChangeResult } from "./transformer/types";
