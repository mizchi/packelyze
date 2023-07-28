import type { MangleValidator, Minifier, OnWarning } from "./types";
import type {
  BatchRenameLocationWithSource,
  BindingNode,
  CodeAction,
  FileChangeResult,
} from "./transform/transformTypes";

import ts from "typescript";
import path from "node:path";
import {
  expandToSafeRenameLocations,
  getActionsAtNodes,
  getExportedInProjectCreator,
  getLocalsInFile,
} from "./transform/mangler";
import { IncrementalLanguageService } from "./ts/services";
import { getRenamedFileChanges } from "./ts/renamer";

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
  service: IncrementalLanguageService,
  projectPath: string,
  rootFileNames: string[],
  targetFileNames: string[],
  withOriginalComment: boolean = false,
  validator: MangleValidator = aggressiveMangleValidator,
  onwarn: OnWarning = () => {},
): Minifier {
  // const registory = ts.createDocumentRegistry();
  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectPath, fname);
  };

  const sourceMaps = new Map<string, string>();
  return {
    process,
    // exists: host.fileExists,
    notifyChange(id, content) {
      service.writeSnapshotContent(id, content);
      // TODO: update only changed files
      process();
    },
    getSourceMapForFile(id) {
      return sourceMaps.get(id);
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
    const files = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const isExported = getExportedInProjectCreator(checker, rootFiles, files, validator);
    const nodes = files.flatMap(getLocalsInFile).filter(isExported);
    const actions = getActionsAtNodes(checker, nodes, withOriginalComment);
    const renames = expandToSafeRenameLocations(service.findRenameLocations, actions, onwarn);

    const fileChanges: FileChangeResult[] = getRenamedFileChanges(renames, service.readSnapshotContent, normalizePath);

    for (const change of fileChanges) {
      service.writeSnapshotContent(change.fileName, change.content);
      if (change.map) sourceMaps.set(change.fileName, change.map);
    }
  }
}
