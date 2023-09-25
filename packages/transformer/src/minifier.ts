import type { BindingNode, MangleValidator, Minifier, OnWarning } from "./types";

import path from "node:path";
import ts from "typescript";
import { canNodeRename, expandToSafeRenames, getExportedInProjectCreator, getLocalsInFile } from "./transform/mangler";
import { getChangesAfterRename } from "./ts/renamer";
import { IncrementalLanguageService } from "./ts/services";

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

    if (ts.isEnumDeclaration(node) || ts.isEnumMember(node)) {
      return false;
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
      return service.readSnapshotContent(id);
    },
  };

  function process() {
    const rootFiles = rootFileNames.map((fname) => service.getCurrentSourceFile(fname)!);
    const files = targetFileNames.map((fname) => service.getCurrentSourceFile(fname)!);

    const checker = service.getProgram()!.getTypeChecker();
    const isExportedNode = getExportedInProjectCreator(checker, rootFiles, files, validator);
    const nodes = files.flatMap(getLocalsInFile).filter(isExportedNode).filter(canNodeRename);
    const renames = expandToSafeRenames(service.findRenameLocations, nodes, onwarn);
    const changes = getChangesAfterRename(renames, service.readSnapshotContent, normalizePath);
    for (const change of changes) {
      service.writeSnapshotContent(change.fileName, change.content);
      if (change.map) sourceMaps.set(change.fileName, change.map);
    }
  }
}
