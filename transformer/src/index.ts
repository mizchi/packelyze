export {
  createIncrementalLanguageServiceHost,
  createIncrementalLanguageService,
  type IncrementalLanguageService,
  type IncrementalLanguageServiceHost,
} from "./typescript/services";
export { getPlugin as tsMinify, type TsMinifyOptions } from "./rollup";
