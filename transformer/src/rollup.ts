import path from "node:path";
import process from "node:process";
import { InputOption, Plugin } from "rollup";
import ts from "typescript";
import { type Minifier, createMinifier } from "./minifier";

const BASE_EXTENSIONS = [".ts", ".tsx", ".mts", ".mtsx", ".js", ".jsx", ".mjs", ".mjsx"];

export type TsMinifyOptions = {
  // current dir
  cwd?: string;
  // searching extension for rollup resolveId
  extensions?: string[];
  // explicit rootFileNames (required by vite)
  rootFileNames?: string[];
  // override compiler options
  compilerOptions?: Partial<ts.CompilerOptions>;
  // override transpile compiler options
  transpileOptions?: Partial<ts.CompilerOptions>;
  // transform only include
  include?: string[];
  // load transformed code only to use with other plugins (e.g. rollup-plugin-ts)
  preTransformOnly?: boolean;
};

export function getPlugin(opts: TsMinifyOptions = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const overrideCompilerOptions = opts.compilerOptions;
  const resolveIdFromSpecifier = createDefaultResolver(cwd, opts.extensions ?? BASE_EXTENSIONS);

  // initialize on options with input
  let minifier: Minifier;
  const plugin: Plugin = {
    name: "test",
    options(options) {
      const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");
      const tsconfig = ts.readConfigFile(configPath!, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, cwd);
      const targetFileNames = parsed.fileNames.filter((fname) => !fname.endsWith(".d.ts"));
      const rootFileNames = opts.rootFileNames
        ? opts.rootFileNames.map((x) => {
            if (x.startsWith("/")) return x;
            return path.join(cwd, x);
          })
        : options.input
        ? inputToRootFileNames(options.input)
        : [];
      if (rootFileNames.length === 0) {
        throw new Error("input is not specified");
      }
      minifier = createMinifier(cwd, rootFileNames, targetFileNames, parsed.options, overrideCompilerOptions);
      minifier.process();
    },
    load(id) {
      return minifier.readFile(id);
    },
    resolveId(id, importer) {
      // delegate to other plugins
      if (opts.preTransformOnly) return;
      if (importer) {
        let resolvedId = path.join(path.dirname(importer), id);
        const found = resolveIdFromSpecifier(resolvedId);
        if (found) return found;
      } else {
        if (id.startsWith("/")) {
          return id;
        }
        return path.join(cwd, id);
      }
    },
    transform(code, id) {
      const mergedTranspileCompilerOptions: ts.CompilerOptions = {
        ...minifier.getCompilerOptions(),
        ...opts.transpileOptions,
      };
      // delegate to other plugins
      if (opts.preTransformOnly) return;
      // return minifier.transform(code, id);
      // const nid = normalizePath(id);
      if (minifier.exists(id)) {
        const result = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: mergedTranspileCompilerOptions,
        });
        return {
          code: result.outputText,
          map: result.sourceMapText,
        };
      }
    },
  };
  return plugin;
  function inputToRootFileNames(input: InputOption, cwd: string = process.cwd()) {
    if (typeof input === "object") {
      input = Object.values(input);
    }
    if (typeof input === "string") {
      input = [input];
    }
    return input.map((fname) => {
      if (fname.startsWith("/")) {
        return fname;
      }
      return path.join(cwd, fname);
    });
  }
  function createDefaultResolver(cwd: string, extensions: string[] = BASE_EXTENSIONS) {
    const finalExtensions = ["", ...extensions, ...extensions.map((ext) => "/index" + ext)];
    return (specifier: string) => {
      for (const ext of finalExtensions) {
        const exist = ts.sys.fileExists(specifier + ext);
        if (exist) return specifier + ext;
      }
    };
  }
}
