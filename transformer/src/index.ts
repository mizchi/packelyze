// to keep interface
// export type {
//   MappedType,
//   AnonymousType,
//   TypeWithId,
//   SymbolWithId,
// } from "./typescript/types";

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
