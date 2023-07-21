import { MinifierProcessStep, type Minifier, MinifierProcessGenerator } from "./types";
import type { BatchRenameLocationWithSource, CodeAction, FileChangeResult } from "./transformer/types";

import ts from "typescript";
import path from "node:path";
import { expandToSafeRenameLocations, walkProject, getCodeActionsAtFile } from "./transformer/mangler";
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
    createProcess,
    exists: host.fileExists,
    notifyChange(id, content) {
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
    const processor = createProcess();
    // for debug step
    for (const step of processor) {
      switch (step.stepName) {
        case MinifierProcessStep.PreDiagnostic: {
          break;
        }
        case MinifierProcessStep.Analyze: {
          break;
        }
        case MinifierProcessStep.CreateActionsForFile: {
          break;
        }
        case MinifierProcessStep.AllActionsCreated: {
          // console.log(
          //   "[minifier:actions]",
          //   step.actions.filter((x) => x.original === "start"),
          //   "-----------------",
          //   step.actions.filter((x) => x.original === "start"),
          // );
          break;
        }
        case MinifierProcessStep.ExpandRenameLocations: {
          break;
        }
        case MinifierProcessStep.ApplyFileChanges: {
          break;
        }
        case MinifierProcessStep.PostDiagnostic: {
          break;
        }
      }
    }
  }

  function* createProcess(): MinifierProcessGenerator {
    // {
    //   const program = service.getProgram()!;
    //   const preDiagnostics = program.getSemanticDiagnostics();
    //   yield { name: "pre-diagnostic", diagnostics: preDiagnostics };
    // }

    const rootFiles = rootFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const checker = service.getProgram()!.getTypeChecker();
    const targetsFiles = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const visited = walkProject(checker, rootFiles, targetsFiles);

    yield { stepName: MinifierProcessStep.Analyze, visited };

    const allActions: CodeAction[] = [];
    for (const targetFile of targetsFiles) {
      const actions = getCodeActionsAtFile(checker, visited, targetFile, withOriginalComment);
      yield {
        stepName: MinifierProcessStep.CreateActionsForFile,
        actions,
        fileName: targetFile.fileName,
      };
      allActions.push(...actions);
    }

    yield { stepName: MinifierProcessStep.AllActionsCreated, actions: allActions };

    const renames: BatchRenameLocationWithSource[] = expandToSafeRenameLocations(
      service.findRenameLocations,
      allActions,
    );

    yield { stepName: MinifierProcessStep.ExpandRenameLocations, renames };

    const fileChanges: FileChangeResult[] = getRenamedFileChanges(renames, service.readSnapshotContent, normalizePath);

    yield { stepName: MinifierProcessStep.ApplyFileChanges, changes: fileChanges };
    for (const change of fileChanges) {
      service.writeSnapshotContent(change.fileName, change.content);
      if (change.map) sourceMaps.set(change.fileName, change.map);
    }
    // {
    //   const postProgram = service.getProgram()!;
    //   const postDiagnostics = postProgram.getSemanticDiagnostics();
    //   yield { name: "post-diagnostic", diagnostics: postDiagnostics };
    // }
  }
}
