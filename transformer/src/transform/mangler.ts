import type { FindRenameLocations, BatchRenameLocation } from "../ts/types";
import { WarningCode, type OnWarning, MangleValidator } from "./../types";

import ts from "typescript";
import { createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../ts/renamer";
import {
  type CodeAction,
  SymbolBuilder,
  BatchRenameLocationWithSource,
  BindingNode,
  ProjectExported,
} from "./transformTypes";
import { findBindingsInFile, createIsBindingExported, getLocalExportedSymbols } from "./relation";
import { getAnnotationAtNode } from "../ts/comment";
import { sortBy } from "../utils";

function isTypeDecralation(binding: BindingNode) {
  return (
    (ts.isTypeAliasDeclaration(binding.parent) || ts.isInterfaceDeclaration(binding.parent)) &&
    binding.parent.name === binding
  );
}

export function getMangleNodesInFile(
  checker: ts.TypeChecker,
  projectExported: ProjectExported,
  file: ts.SourceFile,
  isRoot: boolean,
  validator?: MangleValidator,
): BindingNode[] {
  const bindings = findBindingsInFile(file);
  const localExported = getLocalExportedSymbols(checker, file);
  const isExportedFn = createIsBindingExported(checker, projectExported, localExported);
  return bindings.filter((binding) => {
    return canMangle(binding, isExportedFn(binding, isRoot), validator);
  });
  function canMangle(binding: BindingNode, isExported: boolean, validator?: MangleValidator) {
    const validatorRejected = validator?.(binding) === false;
    const annotation = getAnnotationAtNode(binding);
    const isForceInternal = annotation?.internal === true;
    // const isForceExternal = annotation?.external === true;
    if (validatorRejected) {
      return false;
    }
    if (isTypeDecralation(binding)) {
      return false;
    }
    if (isForceInternal) {
      return true;
    }
    if (isExported) {
      return false;
    }
    return true;
  }
}

export function getCodeActionsFromBindings(
  checker: ts.TypeChecker,
  bindings: BindingNode[],
  withOriginalComment: boolean = false,
): CodeAction[] {
  const symbolBuilder = createSymbolBuilder();
  return bindings.flatMap((node) => {
    return getCodeActionForBinding(symbolBuilder, node, withOriginalComment) ?? [];
  });

  function getCodeActionForBinding(
    symbolBuilder: SymbolBuilder,
    node: BindingNode,
    withOriginalComment: boolean = false,
  ): CodeAction | undefined {
    const validate = createNameValidator(checker, node);
    // if (!(ts.isIdentifier(node) || ts.isPrivateIdentifier(node))) {
    //   throw new Error("unexpected node type " + node.kind);
    // }
    const originalName = node.text;

    // maybe react component name
    // TODO: const Foo = ...;
    const maybeFunctionComponentNode =
      (ts.isFunctionDeclaration(node.parent) || ts.isFunctionExpression(node.parent)) &&
      isComponentFunctionName(originalName);
    if (maybeFunctionComponentNode) {
      // console.log("[mangle] maybe react component", originalName);
      return;
    }
    // create new symbol builder?

    // FIXME: should consume converted name for usedNames check
    const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);
    const to = withOriginalComment ? `/*${originalName}*/${newName}` : newName;
    const annotation = getAnnotationAtNode(node);
    const action: CodeAction = {
      parentKind: node.parent.kind,
      actionType: "replace",
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to,
      annotation: annotation,
      start: node.getStart(),
      node: node,
      // originalTrial: trial,
    };
    return action;
    function isComponentFunctionName(name: string) {
      return !/[a-z]/.test(name[0]);
    }
    function createNameValidator(checker: ts.TypeChecker, node: ts.Node) {
      // TODO: check is valid query
      const locals = checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariable);
      const localNames = new Set(locals.map((x) => x.name));
      const usedNames = new Set<string>();
      return (newName: string) => {
        const conflicted = localNames.has(newName);
        const used = usedNames.has(newName);
        if (!conflicted && !used) {
          usedNames.add(newName);
          return true;
        }
        return false;
      };
    }
  }
}

// exclude duplicated rename locations
export function expandToSafeRenameLocations(
  findRenameLocations: FindRenameLocations,
  actions: CodeAction[],
  onWarning?: OnWarning,
): BatchRenameLocationWithSource[] {
  const sortedActions = sortBy(actions, (a) => {
    if (a.parentKind === ts.SyntaxKind.PropertyAssignment) {
      return -1;
    } else {
      return 1;
    }
  });
  // stop rename for same position
  const touchingLocations = new Set<string>();

  return [...sortedActions.flatMap(toSafeRenameLocations)];

  function toSafeRenameLocations(action: CodeAction): BatchRenameLocationWithSource[] {
    const touchKey = actionToKey(action);
    if (touchingLocations.has(touchKey)) return [];
    const locations = findBatchRenameLocations(
      findRenameLocations,
      action.fileName,
      action.start,
      action.original,
      action.to,
    );
    if (!locations) return [];

    // stop by conflict
    const renameKeys = locations.map(renameLocationToKey);
    if (renameKeys.some((key) => touchingLocations.has(key))) {
      const conflicts = renameKeys.filter((key) => touchingLocations.has(key));
      onWarning?.({
        code: WarningCode.MANGLE_STOP_BY_LOCATION_CONFLICT,
        message: conflicts.join("\n"),
      });
      return [];
    }
    for (const renameKey of renameKeys) {
      touchingLocations.add(renameKey);
    }

    // only touching if node is anotated by @external
    if (action.annotation?.external) {
      onWarning?.({
        code: WarningCode.MANGLE_STOP_BY_EXTERNAL,
        message: `${action.original} is annotated by @external`,
      });
      return [];
    }
    // return with source  action
    return locations.map((rename) => ({ ...rename, action: action }) satisfies BatchRenameLocationWithSource);
  }

  function actionToKey(action: CodeAction): string {
    return `${action.fileName}:${action.start}`;
  }

  function renameLocationToKey(rename: BatchRenameLocation): string {
    return `${rename.fileName}:${rename.textSpan.start}`;
  }
}
