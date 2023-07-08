import ts from "typescript";
import { findDeclarationsFromSymbolWalkerVisited } from "../analyzer/nodeWalker";
import { SymbolWalker, createGetSymbolWalker } from "../analyzer/symbolWalker";
import { SymbolBuilder, createSymbolBuilder } from "./symbolBuilder";
import { FindRenameLocations, RenameItem, findRenameItems } from "./renamer";
import { toReadableNode, toReadableSymbol } from "../nodeUtils";
import { findSideEffectSymbols } from "../analyzer/effects";

export type MangleRenameAction = {
  fileName: string;
  original: string;
  to: string;
  start: number;
  isAssignment: boolean;
};

export function findExportedNodesFromRoot(checker: ts.TypeChecker, symbolWalker: SymbolWalker, root: ts.SourceFile) {
  // const symbolWalker = createGetSymbolWalker(checker)();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }
  // const visited = symbolWalker.getVisited();
  // return findDeclarationsFromSymbolWalkerVisited(visited);
}

export function findMangleNodes(checker: ts.TypeChecker, file: ts.SourceFile, exportedNodes: Set<ts.Node>) {
  const bindingIdentifiers = getLocalBindings(checker, file);

  const manglables = new Set<ts.Node>();
  const fileExportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);

  // console.log(
  //   "findMangleNodes:exports",
  //   [...fileExportedSymbols].map((s) => toReadableSymbol(s)),
  //   fileExportedSymbols[0].declarations?.[0] && toReadableNode(fileExportedSymbols[0].declarations?.[0]!),
  // );
  for (const identifier of bindingIdentifiers) {
    // skip: type <Foo> = { ... }
    if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
      continue;
    }
    // skip: interface <Foo>{ ... }
    if (ts.isInterfaceDeclaration(identifier.parent) && identifier.parent.name === identifier) {
      continue;
    }

    // node is related to export
    if (exportedNodes.has(identifier.parent)) {
      continue;
    }

    // node is exported
    const symbol = checker.getSymbolAtLocation(identifier)!;
    if (fileExportedSymbols.includes(symbol)) {
      continue;
    }

    manglables.add(identifier);
  }
  return manglables;
}

export function expandRenameActionsToSafeRenameItems(
  findRenameLocations: FindRenameLocations,
  actions: MangleRenameAction[],
) {
  const preActions = actions.filter((x) => !x.isAssignment);

  const postActions = actions.filter((x) => x.isAssignment);

  const preItems: RenameItem[] = preActions.flatMap((action) => {
    const renames = findRenameItems(findRenameLocations, action.fileName, action.start, action.original, action.to);
    return renames ?? [];
  });
  const preTouches = new Set(preItems.map((x) => x.textSpan.start));
  const postItems: RenameItem[] = postActions.flatMap((action) => {
    // already renamed by other action (e.g. PropertySignature)
    if (preTouches.has(action.start)) {
      return [];
    }
    const renames = findRenameItems(findRenameLocations, action.fileName, action.start, action.original, action.to);
    return renames ?? [];
  });
  return [...preItems, ...postItems];
}

export function getRenameActionFromMangleNode(
  checker: ts.TypeChecker,
  symbolBuilder: SymbolBuilder,
  node: ts.Node,
): MangleRenameAction {
  const validate = createNameValidator(checker, node);
  if (!(ts.isIdentifier(node) || ts.isPrivateIdentifier(node))) {
    throw new Error("unexpected node type " + node.kind);
  }
  const originalName = node.text;
  // create new symbol builder?
  const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);

  const isPropertyAssignment = ts.isPropertyAssignment(node.parent);
  return {
    fileName: node.getSourceFile().fileName,
    original: originalName,
    to: newName,
    start: node.getStart(),
    isAssignment: isPropertyAssignment,
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
  // findRenameLocations: FindRenameLocations,
  getSourceFile: (fileName: string) => ts.SourceFile | undefined,
  entry: string,
): (fileName: string) => MangleRenameAction[] {
  const root = getSourceFile(entry)!;
  const symbolWalker = createGetSymbolWalker(checker)();
  findExportedNodesFromRoot(checker, symbolWalker, root);
  const symbolBuilder = createSymbolBuilder();
  return (target: string) => {
    symbolBuilder.reset();
    const file = getSourceFile(target)!;

    // const symbolWalker = createGetSymbolWalker(checker)();
    // const childSymbolWalker = symbolWalker.createChildSymbolWalker();
    const effectNodes = findSideEffectSymbols(checker, file);
    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        symbolWalker.walkSymbol(symbol);
      }
      const type = checker.getTypeAtLocation(node);
      // const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      symbolWalker.walkType(type);
    }
    // const newExportedNodes = new Set<ts.Node>(
    //   [...exportedNodes, ...effectNodes]
    // );
    const visited = symbolWalker.getVisited();
    const exportedNodes = findDeclarationsFromSymbolWalkerVisited(visited);

    const nodes = findMangleNodes(checker, file, exportedNodes);
    return [...nodes].flatMap((node) => {
      return getRenameActionFromMangleNode(checker, symbolBuilder, node);
      // return collectRenameItems(findRenameLocations, file, action.start, action.original, action.to) ?? [];
    });
  };
}

// get local rename candidates
export function getLocalBindings(checker: ts.TypeChecker, node: ts.Node) {
  // const decls: ts.Declaration[] = [];
  // const typeDecls: ts.Declaration[] = [];
  const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];

  ts.forEachChild(node, visit);
  return identifiers;

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      // stop if declare cont v: ...;
      if (hasDeclareKeyword(node)) return;
    }
    if (ts.isVariableDeclaration(node)) {
      // decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      // typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isInterfaceDeclaration(node)) {
      // typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isClassDeclaration(node)) {
      if (hasDeclareKeyword(node)) return;
      // decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }

    // if (ts.isPropertyAssignment(node)) {
    //   // console.log("property assignment", toReadableNode(node));
    //   // decls.push(node);
    //   visitBinding(node.name);
    // }

    if (ts.isPropertyDeclaration(node)) {
      // decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isMethodDeclaration(node)) {
      // decls.push(node);
      visitBinding(node.name);
    }

    if (ts.isPropertySignature(node)) {
      // typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isMethodSignature(node)) {
      // typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isGetAccessorDeclaration(node)) {
      // decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isSetAccessorDeclaration(node)) {
      // decls.push(node);
      visitBinding(node.name);
    }

    if (ts.isFunctionDeclaration(node)) {
      if (hasDeclareKeyword(node)) return;
      // decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    if (ts.isFunctionExpression(node)) {
      if (node.name) {
        visitBinding(node.name);
      }
    }

    if (ts.isEnumDeclaration(node)) {
      if (hasDeclareKeyword(node)) return;

      // decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    if (ts.isModuleDeclaration(node)) {
      if (hasDeclareKeyword(node)) return;

      // decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    ts.forEachChild(node, visit);
  }
  function visitBinding(
    node:
      | ts.BindingPattern
      | ts.BindingElement
      | ts.Identifier
      | ts.PrivateIdentifier
      | ts.ArrayBindingElement
      | ts.ObjectBindingPattern
      | ts.PropertyName,
  ) {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      identifiers.push(node);
    }
    // TODO: consider computed property
    if (ts.isComputedPropertyName(node)) {
      // visitBinding(node.expression);
    }
    if (ts.isBindingElement(node)) {
      visitBinding(node.name);
      if (node.propertyName) {
        visitBinding(node.propertyName);
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        visitBinding(element);
      }
    }
    if (ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        visitBinding(element);
      }
    }
  }
}

function hasDeclareKeyword(
  node: ts.VariableStatement | ts.FunctionDeclaration | ts.ClassDeclaration | ts.ModuleDeclaration | ts.EnumDeclaration,
): boolean {
  return node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false;
}
