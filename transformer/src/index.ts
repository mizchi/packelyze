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
  // TODO: Remove internal type exports
  // SymbolWalker,
  // SymbolWalkerResult,
  MappedType,
  AnonymousType,
  TypeWithId,
  SymbolWithId,
} from "./typescript/types";
// TODO: Remove internal type exports
export type {
  // TODO: Remove internal type exports
  FileChangeResult,
  // TODO: Remove internal type exports
  BatchRenameLocationWithSource,
} from "./transformer/types";
