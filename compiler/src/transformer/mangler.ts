import ts from "typescript";
import { getLocalBindings } from "../analyzer/scope";
import { collectDeclarations } from "../analyzer/nodeWalker";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import { SymbolBuilder, createSymbolBuilder } from "./symbolBuilder";
import { FindRenameLocations, collectRenameItems } from "./renamer";

export function findExportedNodesFromRoot(checker: ts.TypeChecker, root: ts.SourceFile) {
  const symbolWalker = createGetSymbolWalker(checker)();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }
  const visited = symbolWalker.getVisited();
  return collectDeclarations(visited);
}

export function findMangleNodes(checker: ts.TypeChecker, file: ts.SourceFile, exportedNodes: Set<ts.Node>) {
  const bindingIdentifiers = getLocalBindings(file);

  const manglables = new Set<ts.Node>();
  const fileExportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const identifier of bindingIdentifiers) {
    if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
      // skip: type <Foo> = { ... }
      continue;
    }
    if (ts.isInterfaceDeclaration(identifier.parent) && identifier.parent.name === identifier) {
      // skip: interface <Foo>{ ... }
      continue;
    }
    // if (exportedNodes.has(identifier.parent) || exportedNodes.has(identifier)) {

    if (exportedNodes.has(identifier.parent)) {
      // console.log("[skip exported]", identifier.getText());
      continue;
    }
    const symbol = checker.getSymbolAtLocation(identifier)!;
    if (fileExportedSymbols.includes(symbol)) {
      // console.log("[skip exported]", identifier.getText());
      continue;
    }

    manglables.add(identifier);
  }
  return manglables;
}

export type RenameAction = {
  fileName: string;
  original: string;
  to: string;
  start: number;
};

export function getRenameActionsFromMangleNode(
  checker: ts.TypeChecker,
  symbolBuilder: SymbolBuilder,
  node: ts.Node,
): RenameAction {
  const validate = createNameValidator(checker, node);
  const newName = symbolBuilder.create(validate);
  if (!ts.isIdentifier(node)) {
    throw new Error("unexpected node type" + node.kind);
  }
  const originalName = node.text;
  return {
    fileName: node.getSourceFile().fileName,
    original: originalName,
    to: newName,
    start: node.getStart(),
  };
}

export function createNameValidator(checker: ts.TypeChecker, node: ts.Node) {
  const locals = checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariable);
  const localNames = new Set(locals.map((x) => x.name));
  return (newName: string) => {
    return !localNames.has(newName);
  };
}

export function createGetMangleRenameItems(
  checker: ts.TypeChecker,
  findRenameLocations: FindRenameLocations,
  getSourceFile: (fileName: string) => ts.SourceFile | undefined,
  entry: string,
) {
  const root = getSourceFile(entry)!;
  const exportedNodes = findExportedNodesFromRoot(checker, root);
  const symbolBuilder = createSymbolBuilder();
  return (target: string) => {
    symbolBuilder.reset();
    const file = getSourceFile(target)!;
    const nodes = findMangleNodes(checker, file, exportedNodes);
    return [...nodes].flatMap((node) => {
      const action = getRenameActionsFromMangleNode(checker, symbolBuilder, node);
      return collectRenameItems(findRenameLocations, file, action.start, action.original, action.to) ?? [];
    });
  };
}
