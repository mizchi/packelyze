// import { SymbolWalker, createGetSymbolWalker } from './../analyzer/symbolWalker';
import ts from "typescript";
import { createGetSymbolWalker } from "../typescript/symbolWalker";
import { createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../typescript/renamer";
import { getEffectDetectorEnter } from "./effects";
import { composeVisitors, toReadableNode, toReadableSymbol, toReadableType } from "../typescript/utils";
import { FindRenameLocations, SymbolWalkerResult } from "../typescript/types";
import {
  type CodeAction,
  MangleTargetNode as MangleRelatedNode,
  SymbolBuilder,
  BatchRenameLocationWithSource,
} from "./types";
import { type BatchRenameLocation } from "../typescript/types";
import { findRootRelatedNodes, findFileBindings, isMangleBinding } from "./relation";

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
    const composed = composeVisitors(
      // collect effect nodes
      getEffectDetectorEnter(checker, (node) => {
        effectNodes.add(node);
      }),
    );
    composed(file);

    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) symbolWalker.walkSymbol(symbol);
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }
}

export function getActionsForFile(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  file: ts.SourceFile,
  withOriginalComment: boolean = false,
): CodeAction[] {
  const symbolBuilder = createSymbolBuilder();

  const relatedNodes = findRootRelatedNodes(checker, visited);

  // console.log(
  //   "[getActionsForFile] relatedNodes",
  //   visited.symbols.map((x) => toReadableSymbol(x)),
  //   relatedNodes.map((x) => toReadableNode(x)),
  // );

  const mangleNodes = getMangleNodesForFile(file);

  return mangleNodes.flatMap((node) => {
    const action = getCodeActionForNode(symbolBuilder, node, withOriginalComment);
    return action ?? [];
  });

  function getMangleNodesForFile(file: ts.SourceFile): ts.Node[] {
    const bindings = findFileBindings(checker, file);
    const fileSymbol = checker.getSymbolAtLocation(file);
    const exportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];
    return bindings.filter((identifier) => {
      const [result, reason] = isMangleBinding(checker, identifier, relatedNodes, exportSymbols, [...visited.types]);
      // if (identifier.getText() === "extensions") {
      //   // TODO: check why extensions is not mangled
      //   // console.log("[mangle:try]", identifier.getText(), result, reason);
      //   // console.log(
      //   //   "visited:symbols",
      //   //   visited.symbols
      //   //     .filter((x) => x.getName() === "extensions")
      //   //     .map((x) => toReadableSymbol(x)),
      //   //   // "visited:types",
      //   //   // visited.types.filter((x) => x.symbol?.getName() === "extensions"),
      //   // );
      //   // throw "stop";
      // }
      return result;
    });
  }

  function getCodeActionForNode(
    symbolBuilder: SymbolBuilder,
    node: ts.Node,
    withOriginalComment: boolean = false,
  ): CodeAction | undefined {
    const validate = createNameValidator(checker, node);
    if (!(ts.isIdentifier(node) || ts.isPrivateIdentifier(node))) {
      throw new Error("unexpected node type " + node.kind);
    }
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
    const isPropertyAssignment = ts.isPropertyAssignment(node.parent);
    const action: CodeAction = {
      parentKind: node.parent.kind,
      actionType: "replace",
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to,
      start: node.getStart(),
      isAssignment: isPropertyAssignment,
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
  const preActions = actions.filter((x) => !x.isAssignment);
  const postActions = actions.filter((x) => x.isAssignment);
  // stop rename for same position
  const touchingLocations = new Set<string>();

  return [...preActions.flatMap(toSafeRenameLocations), ...postActions.flatMap(toSafeRenameLocations)];

  function toSafeRenameLocations(action: CodeAction): BatchRenameLocationWithSource[] {
    const touchKey = actionToKey(action);
    if (touchingLocations.has(touchKey)) return [];
    const renames = findBatchRenameLocations(
      findRenameLocations,
      action.fileName,
      action.start,
      action.original,
      action.to,
    );
    if (!renames) return [];

    // stop by conflict
    const renameKeys = renames.map(renameLocationToKey);
    if (renameKeys.some((key) => touchingLocations.has(key))) {
      const conflicts = renameKeys.filter((key) => touchingLocations.has(key));
      console.warn("[mangle:action-stop-by-conflict]", action, "by", conflicts);
      return [];
    }
    for (const renameKey of renameKeys) {
      touchingLocations.add(renameKey);
    }
    // return with source  action
    return renames.map((rename) => ({ ...rename, by: action }) satisfies BatchRenameLocationWithSource);
  }

  function actionToKey(action: CodeAction): string {
    return `${action.fileName}:${action.start}`;
  }

  function renameLocationToKey(rename: BatchRenameLocation): string {
    return `${rename.fileName}:${rename.textSpan.start}`;
  }
}
