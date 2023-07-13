import { getRenamedFileChanges } from "./typescript/renamer";
import ts from "typescript";
import path from "node:path";
import { expandToSafeBatchRenameLocations, walkProjectForMangle, getMangleActionsForFile } from "./transformer/mangler";
import { createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "./typescript/services";
import { FileChangeResult, MangleAction } from "./transformer/types";
import { BatchRenameLocation } from "./typescript/types";

// subset of rollup plugin but not only for rollup
export interface Minifier {
  process(): void;
  readFile(fileName: string): string | undefined;
  notifyChange(fileName: string, content: string): void;
  getSourceMapForFile(id: string): string | undefined;
  exists(fileName: string): boolean;
  getCompilerOptions(): ts.CompilerOptions;
}

export function createMinifier(
  projectPath: string,
  rootFileNames: string[],
  targetFileNames: string[],
  compilerOptions: ts.CompilerOptions = {},
  overrideCompilerOptions: Partial<ts.CompilerOptions> = {},
): Minifier {
  const registory = ts.createDocumentRegistry();

  const mergedCompilerOptions: ts.CompilerOptions = {
    ...compilerOptions,
    ...overrideCompilerOptions,
  };

  const host = createIncrementalLanguageServiceHost(projectPath, targetFileNames, mergedCompilerOptions);
  const service = createIncrementalLanguageService(host, registory);
  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectPath, fname); //
  };

  const sourceMaps = new Map<string, string>();
  return {
    process,
    exists: host.fileExists,
    notifyChange(id, content) {
      // service.writeFileSnapshot(id, content);
      service.writeSnapshotContent(id, content);
      // TODO: update only changed files
      process();
    },
    getSourceMapForFile(id) {
      return sourceMaps.get(id);
    },
    getCompilerOptions() {
      return mergedCompilerOptions;
    },
    readFile(id: string) {
      const content = service.readSnapshotContent(id);
      if (content) {
        return content;
      }
    },
  };

  function process() {
    // TODO: handle all
    const rootFiles = rootFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    // const fileNames = options.fileNames.filter((fname) => !fname.endsWith(".d.ts"));
    const checker = service.getProgram()!.getTypeChecker();
    const targetsFiles = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const visited = walkProjectForMangle(checker, rootFiles, targetsFiles);
    // for (const sym of visited.visitedSymbols) {
    //   console.log("[minifier:symbol]", sym.getName());
    // }
    // for (const type of visited.visitedTypes) {
    //   console.log("[minifier:type]", checker.typeToString(type));
    // }
    const actions = targetsFiles.flatMap<MangleAction>((file) => getMangleActionsForFile(checker, visited, file));
    // console.log("[minifier:actions]", actions);
    const renames: BatchRenameLocation[] = expandToSafeBatchRenameLocations(service.findRenameLocations, actions);
    const changes: FileChangeResult[] = getRenamedFileChanges(renames, service.readSnapshotContent, normalizePath);
    for (const change of changes) {
      service.writeSnapshotContent(change.fileName, change.content);
      if (change.map) sourceMaps.set(change.fileName, change.map);
    }
  }
}
