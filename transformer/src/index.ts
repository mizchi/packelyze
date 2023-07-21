// types
export type {
  TsMinifyOptions,
  Minifier,
} from "./types";
export type {
  IncrementalLanguageService,
  IncrementalLanguageServiceHost,
} from "./ts/services";

// instances
export {
  createIncrementalLanguageServiceHost,
  createIncrementalLanguageService,
} from "./ts/services";
export { createMinifier } from "./minifier";
export { getPlugin as tsMinify } from "./rollup";

// ---- to keep internal interfaces ---
export type { ReadableSymbol, ReadbleNode } from "./ts/tsUtils";
export type {
  // TODO: Remove internal type exports
  // TypeWithId,
  // SymbolWithId,
  // SymbolWalker,
  // SymbolWalkerResult,
  // MappedType,
  AnonymousType,
} from "./ts/types";
// TODO: Remove internal type exports
export type {
  // TODO: Remove internal type exports
  FileChangeResult,
  // TODO: Remove internal type exports
  BatchRenameLocationWithSource,
} from "./transform/transformTypes";
