import type { Minifier } from "./types";
import type { BatchRenameLocation } from "./typescript/types";
import type { CodeAction, FileChangeResult } from "./transformer/types";

import ts from "typescript";
import path from "node:path";
import { expandToSafeRenameLocations, walkProject, getActionsForFile } from "./transformer/mangler";
import { createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "./typescript/services";
import { getRenamedFileChanges } from "./typescript/renamer";

export function createMinifier(
  projectPath: string,
  rootFileNames: string[],
  targetFileNames: string[],
  compilerOptions: ts.CompilerOptions = {},
  overrideCompilerOptions: ts.CompilerOptions = {},
  withOriginalComment: boolean = false,
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
    return path.join(projectPath, fname);
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
    const rootFiles = rootFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const checker = service.getProgram()!.getTypeChecker();
    const targetsFiles = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const visited = walkProject(checker, rootFiles, targetsFiles);
    const actions = targetsFiles.flatMap<CodeAction>((file) =>
      getActionsForFile(checker, visited, file, withOriginalComment),
    );
    const renames: BatchRenameLocation[] = expandToSafeRenameLocations(service.findRenameLocations, actions);
    // console.log(
    //   "[minifier:actions]",
    //   actions.filter((x) => x.original === "start"),
    //   "-----------------",
    //   renames.filter((x) => x.original === "start"),
    // );

    const changes: FileChangeResult[] = getRenamedFileChanges(renames, service.readSnapshotContent, normalizePath);
    for (const change of changes) {
      service.writeSnapshotContent(change.fileName, change.content);
      if (change.map) sourceMaps.set(change.fileName, change.map);
    }
    // console.log(
    //   "[minifier:diagnostics]",
    //   diagnostics.map((d) => {
    //     return {
    //       file: d.file?.fileName.replace(projectPath + "/", ""),
    //       messageText: d.messageText,
    //     };
    //   }),
    // );
  }
}
