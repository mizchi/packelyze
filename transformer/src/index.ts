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
export { createMinifier, aggressiveMangleValidator, withTerserMangleValidator } from "./minifier";
export { getPlugin as tsMinify } from "./rollup";

// ---- to keep internal interfaces ---
export type { ReadableSymbol, ReadbleNode } from "./ts/tsUtils";
export type {
  LocalExported,
  ProjectExported,
  MangleActionsWithInvalidated as MangleActionsFromTrials,
} from "./transform/transformTypes";
export type { MinifierStep } from "./types";
