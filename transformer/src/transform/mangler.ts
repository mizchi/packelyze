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
  MangleStopReason,
  MangleTrial,
  MangleReason,
  ProjectExported,
} from "./transformTypes";
import { findBindingsInFile, createIsBindingExported, getLocalExportedSymbols } from "./relation";
import { getAnnotationAtNode } from "../ts/comment";
import { sortBy } from "../utils";

function getMangleTrial(
  checker: ts.TypeChecker,
  binding: BindingNode,
  isExported: boolean,
  validator?: MangleValidator,
): MangleTrial {
  // skip: type <Foo> = { ... }
  const validatedResult = validator?.(binding);
  if (validatedResult === false) {
    return {
      mangle: false,
      node: binding,
      reason: MangleStopReason.CustomValidatorResult,
    };
  }
  if (
    (ts.isTypeAliasDeclaration(binding.parent) || ts.isInterfaceDeclaration(binding.parent)) &&
    binding.parent.name === binding
  ) {
    return {
      mangle: false,
      node: binding,
      reason: MangleStopReason.TypeOnly,
    };
  }
  // skip inferred type
  if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
    if (isExported) {
      return {
        mangle: false,
        node: binding,
        reason: MangleStopReason.External,
      };
    }
  }
  // force mangle by internal annotation
  if (
    // parent is declaration
    (ts.isPropertyDeclaration(binding.parent) ||
      ts.isMethodDeclaration(binding.parent) ||
      ts.isPropertyAssignment(binding.parent)) &&
    // under class/interface/typeAlias
    (ts.isObjectLiteralExpression(binding.parent.parent) ||
      ts.isClassDeclaration(binding.parent.parent) ||
      ts.isClassExpression(binding.parent.parent) ||
      ts.isInterfaceDeclaration(binding.parent.parent) ||
      ts.isTypeNode(binding.parent.parent))
  ) {
    const annotation = getAnnotationAtNode(binding);
    if (annotation?.internal) {
      return {
        mangle: true,
        node: binding,
        reason: MangleReason.Internal,
      };
    }
  }

  // node is related to export
  if (isExported) {
    const annotation = getAnnotationAtNode(binding);
    if (!annotation?.internal) {
      return {
        mangle: false,
        node: binding,
        reason: MangleStopReason.Exported,
        relatedNode: binding.parent,
      };
    } else {
      return {
        mangle: true,
        node: binding,
        reason: MangleReason.Internal,
      };
    }
  }

  // FIXME
  // node is exported
  if (isExported) {
    const symbol = checker.getSymbolAtLocation(binding);
    return {
      mangle: false,
      node: binding,
      reason: MangleStopReason.Exported,
      relatedSymbol: symbol,
    };
  }
  return {
    mangle: true,
    node: binding,
    reason: MangleReason.Local,
  };
}

export function getMangleTrialsInFile(
  checker: ts.TypeChecker,
  projectExported: ProjectExported,
  file: ts.SourceFile,
  validator?: MangleValidator,
): MangleTrial[] {
  const bindings = findBindingsInFile(file);
  const localExported = getLocalExportedSymbols(checker, file);

  const isExportedFn = createIsBindingExported(checker, projectExported, localExported);
  return bindings.map((binding) => {
    return getMangleTrial(checker, binding, isExportedFn(binding), validator);
  });
}

export function getCodeActionsFromTrials(
  checker: ts.TypeChecker,
  trials: MangleTrial[],
  withOriginalComment: boolean = false,
): {
  actions: CodeAction[];
  invalidated: MangleTrial[];
} {
  const symbolBuilder = createSymbolBuilder();
  // const trials = getMangleTrialsInFile(checker, visited, file);
  const actions = trials.flatMap((trial) => {
    if (trial.mangle) {
      return getCodeActionForTrial(symbolBuilder, trial, withOriginalComment) ?? [];
    }
    return [];
  });

  const invalidated = trials.filter((x) => !x.mangle);
  return {
    actions,
    invalidated: invalidated,
  };

  function getCodeActionForTrial(
    symbolBuilder: SymbolBuilder,
    trial: MangleTrial,
    withOriginalComment: boolean = false,
  ): CodeAction | undefined {
    const validate = createNameValidator(checker, trial.node);
    if (!(ts.isIdentifier(trial.node) || ts.isPrivateIdentifier(trial.node))) {
      throw new Error("unexpected node type " + trial.node.kind);
    }
    const originalName = trial.node.text;

    // maybe react component name
    // TODO: const Foo = ...;
    const maybeFunctionComponentNode =
      (ts.isFunctionDeclaration(trial.node.parent) || ts.isFunctionExpression(trial.node.parent)) &&
      isComponentFunctionName(originalName);
    if (maybeFunctionComponentNode) {
      // console.log("[mangle] maybe react component", originalName);
      return;
    }
    // create new symbol builder?

    // FIXME: should consume converted name for usedNames check
    const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);
    const to = withOriginalComment ? `/*${originalName}*/${newName}` : newName;
    const annotation = getAnnotationAtNode(trial.node);
    const action: CodeAction = {
      parentKind: trial.node.parent.kind,
      actionType: "replace",
      fileName: trial.node.getSourceFile().fileName,
      original: originalName,
      to,
      annotation: annotation,
      start: trial.node.getStart(),
      originalTrial: trial,
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
    return locations.map((rename) => ({ ...rename, by: action }) satisfies BatchRenameLocationWithSource);
  }

  function actionToKey(action: CodeAction): string {
    return `${action.fileName}:${action.start}`;
  }

  function renameLocationToKey(rename: BatchRenameLocation): string {
    return `${rename.fileName}:${rename.textSpan.start}`;
  }
}
