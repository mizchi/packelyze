// import { SymbolWalker, createGetSymbolWalker } from './../analyzer/symbolWalker';
import ts from "typescript";
import { createGetSymbolWalker } from "../ts/symbolWalker";
import { createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../ts/renamer";
import { getEffectDetectorWalker } from "./effects";
import { composeWalkers, toReadableNode, toReadableSymbol, toReadableType } from "../ts/tsUtils";
import { FindRenameLocations, SymbolWalkerResult } from "../ts/types";
import {
  type CodeAction,
  SymbolBuilder,
  BatchRenameLocationWithSource,
  BindingNode,
  MangleStopReason,
  MangleTrial,
  MangleReason,
} from "./transformTypes";
import { type BatchRenameLocation } from "../ts/types";
import { findExportRelationsOnProject, findBindingsInFile } from "./relation";
import { getAnnotationAtNode } from "../ts/comment";

// TODO: return reason
export function getMangleTrial(
  checker: ts.TypeChecker,
  binding: BindingNode,
  exportedNodes: ts.Node[],
  exportedSymbols: ts.Symbol[],
  exportedTypes: ts.Type[],
): MangleTrial {
  // skip: type <Foo> = { ... }
  if (ts.isTypeAliasDeclaration(binding.parent) && binding.parent.name === binding) {
    return {
      mangle: false,
      node: binding,
      reason: MangleStopReason.TypeOnly,
    };
  }
  // skip: interface <Foo>{ ... }
  if (ts.isInterfaceDeclaration(binding.parent) && binding.parent.name === binding) {
    return {
      mangle: false,
      node: binding,
      reason: MangleStopReason.TypeOnly,
    };
  }

  // skip inferred type
  if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
    const type = checker.getTypeAtLocation(binding.parent);
    if (exportedTypes.includes(type)) {
      return {
        mangle: false,
        node: binding,
        reason: MangleStopReason.External,
      };
    }

    if (type.symbol && exportedSymbols.includes(type.symbol)) {
      return {
        mangle: false,
        node: binding,
        reason: MangleStopReason.Exported,
        relatedSymbol: type.symbol,
      };
    }

    // inferred object type member will skip mangle: ex. const x = {vvv: 1};
    const objectType = checker.getTypeAtLocation(binding.parent.parent);
    if (objectType.symbol?.name === "__object") {
      return {
        mangle: false,
        node: binding,
        reason: MangleStopReason.UnsupportedInference,
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

    if (annotation?.internal)
      return {
        mangle: true,
        node: binding,
        reason: MangleReason.Internal,
      };
  }
  // node is related to export
  if (exportedNodes.includes(binding.parent)) {
    const annotation = getAnnotationAtNode(binding);
    if (!annotation?.internal) {
      // return [false, "ExportRelated"];
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
  const symbol = checker.getSymbolAtLocation(binding);
  if (symbol && exportedSymbols.includes(symbol)) {
    // return [false, "ExportRelated"];
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

export function walkProject(
  checker: ts.TypeChecker,
  rootFiles: ts.SourceFile[],
  files: ts.SourceFile[],
): SymbolWalkerResult {
  const symbolWalker = createGetSymbolWalker(checker)();
  for (const root of rootFiles) {
    walkRootFile(root);
  }
  for (const file of files) {
    walkTargetFile(file);
  }
  return symbolWalker.getVisited();

  function walkRootFile(root: ts.SourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(root);
    if (!fileSymbol) return;
    const exportedSymbols = checker.getExportsOfModule(fileSymbol);
    for (const exported of exportedSymbols) {
      symbolWalker.walkSymbol(exported);

      const type = checker.getTypeOfSymbol(exported);
      symbolWalker.walkType(type);
      if (type.symbol) {
        symbolWalker.walkSymbol(type.symbol);
      }

      // check exported
      // if it is any type and export type, typescript was lost type tracing
      // ex. export type { MyType } from "./types";
      const exportedSymbol = checker.getExportSymbolOfSymbol(exported);
      // if (exportedSymbol === exported) continue;
      const maybeExportSpecifier = exportedSymbol?.declarations?.[0];
      if (maybeExportSpecifier && ts.isExportSpecifier(maybeExportSpecifier)) {
        const exportSpecifierType = checker.getTypeAtLocation(maybeExportSpecifier);
        symbolWalker.walkType(exportSpecifierType);
        symbolWalker.walkSymbol(exportSpecifierType.symbol!);
      }
    }
  }

  function walkTargetFile(file: ts.SourceFile) {
    const effectNodes: Set<ts.Node> = new Set();
    const walk = composeWalkers(
      // collect effect nodes
      getEffectDetectorWalker(checker, (node) => {
        effectNodes.add(node);
      }),
    );
    walk(file);

    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) symbolWalker.walkSymbol(symbol);
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }
}

export function getMangleTrialsInFile(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  file: ts.SourceFile,
): MangleTrial[] {
  const exportRelatedNodes = findExportRelationsOnProject(checker, visited);
  const bindings = findBindingsInFile(file);
  const fileSymbol = checker.getSymbolAtLocation(file);
  // TODO: remove this
  const localExportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];
  return bindings.map((binder) => {
    return getMangleTrial(checker, binder, exportRelatedNodes, localExportSymbols, [...visited.types]);
  });
}

export function getCodeActionsInFile(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  file: ts.SourceFile,
  withOriginalComment: boolean = false,
): {
  actions: CodeAction[];
  trials: MangleTrial[];
  invalidated: MangleTrial[];
} {
  const symbolBuilder = createSymbolBuilder();
  const trials = getMangleTrialsInFile(checker, visited, file);
  const actions = trials.flatMap((trial) => {
    if (trial.mangle) {
      return getCodeActionForTrial(symbolBuilder, trial, withOriginalComment) ?? [];
    }
    return [];
  });

  const invalidated = trials.filter((x) => !x.mangle);
  return {
    actions,
    trials,
    invalidated: invalidated,
  };

  // function getMangleTrialsAtFile(file: ts.SourceFile): MangleTrial[] {
  //   const bindings = findBindingsInFile(file);
  //   const fileSymbol = checker.getSymbolAtLocation(file);
  //   const exportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];
  //   return bindings.map((identifier) => {
  //     const trial = getMangleTrial(checker, identifier, exportRelatedNodes, exportSymbols, [...visited.types]);
  //     // return trial.mangle;
  //     return trial;
  //   });
  // }

  function getCodeActionForTrial(
    symbolBuilder: SymbolBuilder,
    // node: ts.Node,
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
): BatchRenameLocationWithSource[] {
  // propertyAssingment causes duplicated rename with propertySignature
  // const preActions = actions.filter((x) => !x.isAssignment);
  // const postActions = actions.filter((x) => x.isAssignment);

  const sorted = actions.sort((a, b) => {
    if (a.parentKind === ts.SyntaxKind.PropertyAssignment) {
      return -1;
    } else {
      return 1;
    }
    // return a.start - b.start;
  });
  // stop rename for same position
  const touchingLocations = new Set<string>();

  return [...sorted.flatMap(toSafeRenameLocations)];

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
      console.warn("[mangle:action-stop-by-conflict]", action, "by", conflicts);
      return [];
    }
    for (const renameKey of renameKeys) {
      touchingLocations.add(renameKey);
    }

    // only touching if node is anotated by @external
    if (action.annotation?.external) {
      console.warn("[mangle:action-stop-by-external]", action);
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
