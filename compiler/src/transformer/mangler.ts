import ts from "typescript";
import { getLocalBindings } from "../analyzer/scope";
import { collectDeclarations } from "../analyzer/nodeWalker";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import { SymbolBuilder } from "../symbolBuilder";

export function findMangleNodes(checker: ts.TypeChecker, file: ts.SourceFile) {
  const symbolWalker = createGetSymbolWalker(checker)();
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exports) {
    symbolWalker.walkSymbol(exported);
  }
  const visited = symbolWalker.getVisited();
  const exportedNodes = collectDeclarations(visited);
  const bindingIdentifiers = getLocalBindings(file);

  const manglables = new Set<ts.Node>();
  for (const identifier of bindingIdentifiers) {
    const symbol = checker.getSymbolAtLocation(identifier)!;

    if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
      // skip: type <Foo> = { ... }
      continue;
    }
    if (exportedNodes.has(identifier.parent)) {
      // console.log("[skip exported]", identifier.getText());
      continue;
    }
    if (symbol && exports.includes(symbol)) continue;
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
