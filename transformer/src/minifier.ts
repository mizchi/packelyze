import type { MangleValidator, Minifier, MinifierStep, OnWarning } from "./types";
import type {
  BatchRenameLocationWithSource,
  BindingNode,
  CodeAction,
  FileChangeResult,
} from "./transform/transformTypes";

import ts from "typescript";
import path from "node:path";
import { expandToSafeRenameLocations, getCodeActionsFromBindings, getMangleNodesInFile } from "./transform/mangler";
import { createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "./ts/services";
import { getRenamedFileChanges } from "./ts/renamer";
import { MinifierProcessStep } from "./types";
import { walkProjectExported } from "./transform/relation";

export const aggressiveMangleValidator: MangleValidator = (_binding: BindingNode) => {
  return true;
};

// delegate to terser
export const withTerserMangleValidator: MangleValidator = (binding: BindingNode) => {
  // skip if binding is not identifier
  if (ts.isIdentifier(binding)) {
    const node = binding.parent;
    if (!node) return;

    // under module foo { function foo(){} }
    const underModule = ts.isModuleBlock(node.parent);
    if (underModule) {
      return true;
    }
    // if (ts.isModuleBody(node.parent)) {
    //   return true;
    // }

    if (ts.isVariableDeclaration(node) && !underModule) {
      return false;
    }
    if (ts.isParameter(node)) {
      return false;
    }
    if (ts.isClassDeclaration(node) && !underModule) {
      return false;
    }
    if (ts.isFunctionDeclaration(node) && !underModule) {
      return false;
    }
  }
};

export function createMinifier(
  projectPath: string,
  rootFileNames: string[],
  targetFileNames: string[],
  compilerOptions: ts.CompilerOptions = {},
  overrideCompilerOptions: ts.CompilerOptions = {},
  withOriginalComment: boolean = false,
  validator: MangleValidator = aggressiveMangleValidator,
  onwarn: OnWarning = () => {},
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

  function* createProcess(): Generator<MinifierStep> {
    // {
    //   const program = service.getProgram()!;
    //   const preDiagnostics = program.getSemanticDiagnostics();
    //   yield { name: "pre-diagnostic", diagnostics: preDiagnostics };
    // }

    const rootFiles = rootFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const checker = service.getProgram()!.getTypeChecker();
    const targetsFiles = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const visited = walkProjectExported(checker, rootFiles, targetsFiles);

    yield { stepName: MinifierProcessStep.Analyze, visited };

    const allActions: CodeAction[] = [];

    for (const file of targetsFiles) {
      const isRoot = rootFiles.includes(file);
      const nodes = getMangleNodesInFile(checker, visited, file, isRoot, validator);
      const actions = getCodeActionsFromBindings(checker, nodes, withOriginalComment);
      yield {
        stepName: MinifierProcessStep.CreateActionsForFile,
        actions: actions,
        fileName: file.fileName,
        // invalidated: actions.invalidated,
      };
      allActions.push(...actions);
    }

    yield { stepName: MinifierProcessStep.AllActionsCreated, actions: allActions };
    const renames: BatchRenameLocationWithSource[] = expandToSafeRenameLocations(
      service.findRenameLocations,
      allActions,
      onwarn,
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
