import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { sync as globSync } from "glob";
import { InputOption, Plugin } from "rollup";
import ts from "typescript";
import { createMinifier } from "./minifier";
import {
  IncrementalLanguageService,
  IncrementalLanguageServiceHost,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "./ts/services";
import { Minifier, TsMinifyOptions } from "./types";

const BASE_EXTENSIONS = [".ts", ".tsx", ".mts", ".mtsx", ".js", ".jsx", ".mjs", ".mjsx"];
const TRANSFORM_EXTENSIONS = [".ts", ".tsx", ".mts", ".mtsx"];

export function tsMinifyPlugin(opts: TsMinifyOptions = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const overrideCompilerOptions = opts.compilerOptions;
  const resolveIdFromSpecifier = createDefaultResolver(cwd, opts.extensions ?? BASE_EXTENSIONS);
  const normalize = (id: string) => {
    if (id.startsWith("/")) return id;
    return path.join(cwd, id);
  };

  // initialize on options with input
  let minifier: Minifier;
  // const includes = opts.include?.map(normalize);
  const includes = opts.include ? expandIncludePatterns(opts.include, cwd) : undefined;
  const isTransformTarget = (id: string) => {
    id = normalize(id);
    if (includes?.includes(id)) return true;
    return TRANSFORM_EXTENSIONS.some((ext) => id.endsWith(ext));
  };
  let service: IncrementalLanguageService;
  let host: IncrementalLanguageServiceHost;
  const plugin: Plugin = {
    name: "test",
    options(options) {
      const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");
      if (!configPath) {
        throw new Error("[ts-minify] tsconfig.json is not found");
      }
      const tsconfig = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, cwd);
      const targetFileNames = parsed.fileNames.filter((fname) => !fname.endsWith(".d.ts"));
      const rootFileNames = opts.rootFileNames
        ? opts.rootFileNames.map(normalize)
        : options.input
        ? inputToRootFileNames(options.input)
        : [];
      if (rootFileNames.length === 0) {
        throw new Error("[tsMinify] input is not specified");
      }
      const mergedCompilerOptions: ts.CompilerOptions = {
        ...parsed.options,
        ...overrideCompilerOptions,
      };

      const registory = ts.createDocumentRegistry();
      host = createIncrementalLanguageServiceHost(cwd, targetFileNames, mergedCompilerOptions);
      service = createIncrementalLanguageService(host, registory);
      minifier = createMinifier(
        service,
        cwd,
        rootFileNames,
        targetFileNames,
        opts.withOriginalComment,
        opts.mangleValidator,
      );
      minifier.process();
    },
    // WIP
    watchChange(id, change) {
      if (!isTransformTarget(id)) return;
      if (change.event === "update") {
        const content = fs.readFileSync(id, "utf-8");
        minifier.notifyChange(id, content);
      }
    },
    load(id) {
      if (!isTransformTarget(id)) return;
      return minifier.readFile(id);
    },
    resolveId(id, importer) {
      // delegate to other plugins
      if (opts.preTransformOnly) return;
      if (importer) {
        const foundId = resolveIdFromSpecifier(path.join(path.dirname(importer), id));
        if (foundId && isTransformTarget(foundId)) return foundId;
      } else {
        if (isTransformTarget(id)) return normalize(id);
      }
    },
    transform(code, id) {
      if (!isTransformTarget(id)) return;
      // delegate to other plugins
      if (opts.preTransformOnly) {
        const sourceMap = minifier.getSourceMapForFile(id);
        if (sourceMap) {
          return {
            code,
            map: sourceMap,
          };
        }
      }
      // TODO: multiple sourceMap transforms
      const transpileOptions: ts.CompilerOptions = {
        ...service.getProgram()?.getCompilerOptions()!,
        ...opts.transpileOptions,
      };
      if (host.fileExists(id)) {
        const result = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: transpileOptions,
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

function expandIncludePatterns(include: string[], cwd: string) {
  const expanded: string[] = [];
  for (const pattern of include) {
    const files = globSync(pattern, { cwd });
    expanded.push(...files);
  }
  return [...new Set(expanded)];
}
