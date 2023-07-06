import ts from "typescript";
import { findDeclarationsFromSymbolWalkerVisited } from "../analyzer/nodeWalker";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import { SymbolBuilder, createSymbolBuilder } from "./symbolBuilder";
import { FindRenameLocations, collectRenameItems } from "./renamer";

export type MangleRenameAction = {
  fileName: string;
  original: string;
  to: string;
  start: number;
};

export function findExportedNodesFromRoot(checker: ts.TypeChecker, root: ts.SourceFile) {
  const symbolWalker = createGetSymbolWalker(checker)();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }
  const visited = symbolWalker.getVisited();
  return findDeclarationsFromSymbolWalkerVisited(visited);
}

export function findMangleNodes(checker: ts.TypeChecker, file: ts.SourceFile, exportedNodes: Set<ts.Node>) {
  const bindingIdentifiers = getLocalBindings(file);

  const manglables = new Set<ts.Node>();
  const fileExportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
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

export function getRenameActionsFromMangleNode(
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

// get local rename candidates
export function getLocalBindings(node: ts.Node) {
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
    //   decls.push(node);
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
