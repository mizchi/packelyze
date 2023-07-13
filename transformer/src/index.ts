export {
  createIncrementalLanguageServiceHost,
  createIncrementalLanguageService,
  type IncrementalLanguageService,
  type IncrementalLanguageServiceHost,
} from "./typescript/services";
export {
  createMinifier,
  type Minifier,
} from "./minifier";
export { getPlugin as tsMinify, type TsMinifyOptions } from "./rollup";

// to keep interface
export type {
  MappedType,
  AnonymousType,
  TypeWithId,
  SymbolWithId,
} from "./typescript/types";
