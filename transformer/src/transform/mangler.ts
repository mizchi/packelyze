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
import { getAnnotationAtNode as getAnnotationAtBinding } from "../ts/comment";
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
    const isExported = isExportedFn(binding, isRoot);
    return isProjectInternal(binding, isExported, validator);
  });
  function isProjectInternal(binding: BindingNode, isExported: boolean, validator?: MangleValidator) {
    const validatorRejected = validator?.(binding) === false;
    // TODO: why first hidden is skipped by case24-annotations
    // if (binding.getText() === "hidden") {
    //   console.log("canMangle", projectExported.internal.includes(binding));
    // }
    if (validatorRejected) {
      return false;
    }
    if (isTypeDecralation(binding)) {
      return false;
    }
    if (projectExported.internal.includes(binding)) {
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
    const originalName = node.text;

    // maybe react component name
    // TODO: const Foo = ...;
    const maybeFunctionComponentNode =
      (ts.isFunctionDeclaration(node.parent) || ts.isFunctionExpression(node.parent)) &&
      isComponentFunctionName(originalName);
    if (maybeFunctionComponentNode) {
      return;
    }

    // TODO: renamer by ast kind
    const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);
    const to = withOriginalComment ? `/*${originalName}*/${newName}` : newName;
    const annotation = getAnnotationAtBinding(node);

    if (annotation?.external) {
      // stop by external
      return;
    }
    const action: CodeAction = {
      parentKind: node.parent.kind,
      actionType: "replace",
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to,
      annotation: annotation,
      start: node.getStart(),
      node,
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

const enum NodePriority {
  VeryHigh = 0,
  High = 1,
  Normal = 5,
  Low = 10,
  VeryLow = 20,
}

function getActionPriority(action: CodeAction) {
  // prefer type signature
  if (ts.isTypeNode(action.node) || ts.isTypeNode(action.node.parent)) {
    return NodePriority.High;
  }

  if (action.node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression) {
    return NodePriority.Low;
  }
  // Low priority for property assignment
  if (action.node.kind === ts.SyntaxKind.PropertyAssignment) {
    return NodePriority.VeryLow;
  }

  return NodePriority.Normal;
}

// exclude duplicated rename locations
export function expandToSafeRenameLocations(
  findRenameLocations: FindRenameLocations,
  actions: CodeAction[],
  onWarning?: OnWarning,
): BatchRenameLocationWithSource[] {
  const touchings = new Set<string>();
  return sortBy(actions, getActionPriority).flatMap(toSafeRenameLocations);

  function toSafeRenameLocations(action: CodeAction): BatchRenameLocationWithSource[] {
    const touchKey = actionToKey(action);
    if (touchings.has(touchKey)) return [];
    const locations = findBatchRenameLocations(
      findRenameLocations,
      action.fileName,
      action.start,
      action.original,
      action.to,
    );
    if (!locations) return [];

    // stop by conflict
    const tryingKeys = locations.map(renameToKey);
    if (tryingKeys.some((key) => touchings.has(key))) {
      const conflicts = tryingKeys.filter((key) => touchings.has(key));
      onWarning?.({
        code: WarningCode.MANGLE_STOP_BY_LOCATION_CONFLICT,
        message: conflicts.join("\n"),
      });
      return [];
    }
    for (const renameKey of tryingKeys) {
      touchings.add(renameKey);
    }
    return locations.map((rename) => ({ ...rename, action }) satisfies BatchRenameLocationWithSource);
  }

  function actionToKey(action: CodeAction): string {
    return `${action.fileName}-${action.start}`;
  }

  function renameToKey(rename: BatchRenameLocation): string {
    return `${rename.fileName}-${rename.textSpan.start}`;
  }
}
