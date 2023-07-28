export type {
  TsMinifyOptions,
  Minifier,
} from "./types";
export type {
  IncrementalLanguageService,
  IncrementalLanguageServiceHost,
} from "./ts/services";

export {
  createIncrementalLanguageServiceHost,
  createIncrementalLanguageService,
} from "./ts/services";
export { createMinifier, aggressiveMangleValidator, withTerserMangleValidator } from "./minifier";
export { tsMinifyPlugin as tsMinify } from "./rollup";

type Local = {
  $value: number;
};

const local: Local = {
  $value: 1,
};
