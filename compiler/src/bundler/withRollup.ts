import { getRenamedChanges } from "./../transformer/renamer";
import { Plugin } from "rollup";
import ts from "typescript";
import path from "node:path";
import { expandRenameActionsToSafeRenameItems, getMangleNodes, getMangleActionFromNode, walkRelatedNodesFromRoot } from "../transformer/mangler";

import { createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "../services";
import { createSymbolBuilder } from "../transformer/symbolBuilder";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import { findSideEffectSymbols } from "../transformer/effects";

export function getPlugin({ projectPath }: { projectPath: string }) {
  const tsconfig = ts.readConfigFile(path.join(projectPath, "tsconfig.json"), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, projectPath);
  const registory = ts.createDocumentRegistry();
  const host = createIncrementalLanguageServiceHost(projectPath, options.fileNames, options.options);
  const service = createIncrementalLanguageService(host, registory);
  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    const root = projectPath;
    return path.join(root, fname); //
  };
  const checker = service.getProgram()!.getTypeChecker();

  // const root = service.getProgram()!.getSourceFile("src/index.ts")!;
  const symbolBuilder = createSymbolBuilder();
  const symbolWalker = createGetSymbolWalker(checker)();
  // createGetMangleRenameItems(checker, service.getCurrentSourceFile, symbolWalker, "index.ts");
  const root = service.getProgram()!.getSourceFile("index.ts")!;
    // omit .d.ts for rename target
    const fileNames = service
    .getProgram()!
    .getRootFileNames()
    .filter((fname) => !fname.endsWith(".d.ts"));

  walkRelatedNodesFromRoot(checker, symbolWalker, root);
  // walk all files
  for (const fname of fileNames) {
    const file = service.getCurrentSourceFile(fname)!;
    const effectNodes = findSideEffectSymbols(checker, file);
    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        symbolWalker.walkSymbol(symbol);
      }
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }

  const visited = symbolWalker.getVisited();
  const nodes = fileNames.flatMap((fname) => {
    symbolBuilder.reset();
    const file = service.getCurrentSourceFile(fname)!;
    return getMangleNodes(checker, visited, file);
  });
  const actions =  nodes.flatMap((node) => getMangleActionFromNode(checker, symbolBuilder, node));

  const items = expandRenameActionsToSafeRenameItems(service.findRenameLocations, actions);
  const changes = getRenamedChanges(items, service.readSnapshotContent, normalizePath);
  for (const change of changes) {
    service.writeSnapshotContent(change.fileName, change.content);
  }

  const plugin: Plugin = {
    name: "test",
    options(options) {
      // console.log("on-options", options);
    },
    resolveId(id, importer) {
      let resolvedId = importer ? path.resolve(path.dirname(importer), id) : id;
      resolvedId = resolvedId.endsWith(".ts") ? resolvedId : resolvedId + ".ts";
      if (resolvedId) {
        return resolvedId;
      }
    },
    load(id) {
      // console.log("[load]", id, content);
      const content = service.readSnapshotContent(id);
      if (content) {
        return content;
      }
    },
    transform(code, id) {
      const nid = normalizePath(id);
      if (host.fileExists(nid)) {
        // const result = (nid, code);
        const result = ts.transpileModule(code, {
          fileName: nid,
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            noImplicitAny: true,
          },
        });
        return {
          code: result.outputText,
          map: result.sourceMapText,
        };
      }
    },
  };
  return plugin;
  // return { plugin, normalizePath, service };
  // return { plugin, normalizePath, service };
}
