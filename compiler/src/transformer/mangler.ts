import ts from "typescript";
import { SymbolWalker, SymbolWalkerVisited } from "../analyzer/symbolWalker";
import { SymbolBuilder } from "./symbolBuilder";
import { FindRenameLocations, RenameItem, findRenameItems } from "./renamer";
// import { toReadableNode, toReadableSymbol } from "../nodeUtils";
import { findSideEffectSymbols } from "./effects";

export type MangleAction = {
  fileName: string;
  original: string;
  to: string;
  start: number;
  isAssignment: boolean;
};

export function walkRelatedNodesFromRoot(checker: ts.TypeChecker, symbolWalker: SymbolWalker, root: ts.SourceFile) {
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }
}

export function findMangleNodes(checker: ts.TypeChecker, file: ts.SourceFile, exportedNodes: Set<ts.Node>) {
  const bindingIdentifiers = getLocalBindings(checker, file);

  const manglables = new Set<ts.Node>();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);

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
    if (exportedSymbols.includes(symbol)) {
      continue;
    }

    manglables.add(identifier);
  }
  return manglables;
}

export function expandRenameActionsToSafeRenameItems(
  findRenameLocations: FindRenameLocations,
  actions: MangleAction[],
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


export function getMangleActionFromNode(
  checker: ts.TypeChecker,
  symbolBuilder: SymbolBuilder,
  node: ts.Node,
): MangleAction {
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
  function createNameValidator(checker: ts.TypeChecker, node: ts.Node) {
    const locals = checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariable);
    const localNames = new Set(locals.map((x) => x.name));
    return (newName: string) => {
      return !localNames.has(newName);
    };
  }
}

export function getMangleNodes(
  checker: ts.TypeChecker,
  // getSourceFile: (fileName: string) => ts.SourceFile | undefined,
  // symbolWalker: SymbolWalker,
  // symbolBuilder: SymbolBuilder,
  visited: SymbolWalkerVisited,
  file: ts.SourceFile,
): ts.Node[] {
  // symbolBuilder.reset();
  // const file = getSourceFile(target)!;
  const exportedNodes = findDeclarationsFromSymbolWalkerVisited(visited);
  return [...findMangleNodes(checker, file, exportedNodes)];
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

type MangleNode =
  | ts.TypeLiteralNode
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.TypeAliasDeclaration
  | ts.InterfaceDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.MethodDeclaration
  | ts.ClassDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isMangleNode(node: ts.Node): node is MangleNode {
  return (
    ts.isTypeNode(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeLiteralNode(node) ||
    ts.isClassDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodSignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

export function findDeclarationsFromSymbolWalkerVisited(visited: SymbolWalkerVisited, debug: boolean = false) {
  const log = debug ? console.log : () => {};
  const visitedNodes = new Set<ts.Node>();
  for (const symbol of visited.visitedSymbols) {
    for (const declaration of symbol.getDeclarations() ?? []) {
      visitNode(declaration, 0);
    }
  }
  return visitedNodes;

  function visitNode(node: ts.Node, depth: number) {
    log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

    if (!isMangleNode(node)) return;
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);

    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitNode(type.expression, depth + 1);
        }
      }
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        visitNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitNode(type.expression, depth + 1);
        }
      }
    }

    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }

    if (ts.isPropertySignature(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }

    if (ts.isPropertyDeclaration(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodDeclaration(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isGetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        visitNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      visitNode(node.name, depth + 1);
    }
  }
}
