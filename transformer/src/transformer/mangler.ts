// import { SymbolWalker, createGetSymbolWalker } from './../analyzer/symbolWalker';
import ts from "typescript";
import { createGetSymbolWalker } from "../typescript/symbolWalker";
import { createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../typescript/renamer";
import { getEffectDetectorEnter } from "./effects";
import { composeVisitors, toReadableNode, toReadableSymbol } from "../typescript/utils";
import { FindRenameLocations, SymbolWalkerResult } from "../typescript/types";
import { type MangleAction, MangleTargetNode as MangleRelatedNode, SymbolBuilder } from "./types";
import { type BatchRenameLocation } from "../typescript/types";
import { findRelatedNodes, getBindingsForFile, isMangleBinding } from "./relation";

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
): MangleAction[] {
  const symbolBuilder = createSymbolBuilder();

  const relatedNodes = findRelatedNodes(checker, visited);

  // console.log(
  //   "[getActionsForFile] relatedNodes",
  //   visited.symbols.map((x) => toReadableSymbol(x)),
  //   relatedNodes.map((x) => toReadableNode(x)),
  // );

  const mangleNodes = getMangleNodesForFile(file);

  return mangleNodes.flatMap((node) => {
    const action = getMangleActionForNode(symbolBuilder, node);
    return action ?? [];
  });

  function getMangleNodesForFile(file: ts.SourceFile): ts.Node[] {
    const bindings = getBindingsForFile(checker, file);
    const fileSymbol = checker.getSymbolAtLocation(file);
    const exportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];
    return bindings.filter((identifier) => {
      return isMangleBinding(checker, identifier, relatedNodes, exportSymbols, [...visited.types]);
    });
  }

  function getMangleActionForNode(symbolBuilder: SymbolBuilder, node: ts.Node): MangleAction | undefined {
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
    const isPropertyAssignment = ts.isPropertyAssignment(node.parent);
    return {
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to: newName,
      start: node.getStart(),
      isAssignment: isPropertyAssignment,
    };
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
export function expandToSafeRenameLocations(findRenameLocations: FindRenameLocations, actions: MangleAction[]) {
  // propertyAssingment causes duplicated rename with propertySignature
  const preActions = actions.filter((x) => !x.isAssignment);
  const postActions = actions.filter((x) => x.isAssignment);
  // stop rename for same position
  const touchingLocations = new Set<string>();

  return [...preActions.flatMap(toSafeRenameLocations), ...postActions.flatMap(toSafeRenameLocations)];

  function toSafeRenameLocations(action: MangleAction) {
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
      return [];
    }
    for (const renameKey of renameKeys) {
      touchingLocations.add(renameKey);
    }
    return renames;
  }

  function actionToKey(action: MangleAction) {
    return `${action.fileName}:${action.start}`;
  }
  function renameLocationToKey(rename: BatchRenameLocation) {
    return `${rename.fileName}:${rename.textSpan.start}`;
  }
}
