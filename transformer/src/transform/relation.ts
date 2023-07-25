import ts from "typescript";
import type { BindingNode, LocalExported, MangleTargetNode, ProjectExported } from "./transformTypes";
import { SymbolWalkerResult } from "../ts/types";
import { composeWalkers, formatCode } from "../ts/tsUtils";
import { getEffectDetectorWalker } from "./detector";
import { createGetSymbolWalker } from "../ts/symbolWalker";

export function findBindingsInFile(file: ts.Node): BindingNode[] {
  const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];
  ts.forEachChild(file, visit);
  return identifiers;
  function visit(node: ts.Node) {
    // console.log("[bindings]", ts.SyntaxKind[node.kind], "\n" + node.getText());
    // stop if declare const ...
    if (ts.isVariableStatement(node) && hasDeclareOrAbstractModifier(node)) {
      return;
    }

    // only for classes
    // ObjectLiteral's methodDeclaration will be broken
    const isClassMember = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (isClassMember && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
      if (hasDeclareOrAbstractModifier(node)) return;
      visitNamedBinding(node.name);
    }
    // Supported named declarations
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassExpression(node) ||
      ts.isPropertyAssignment(node)
    ) {
      if (hasDeclareOrAbstractModifier(node)) return;
      if (node.name) visitNamedBinding(node.name);
    }
    // if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
    //   visitNamedBinding(node);
    // }
    ts.forEachChild(node, visit);
  }
  function visitNamedBinding(node: ts.DeclarationName | ts.BindingElement | ts.ArrayBindingElement) {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      identifiers.push(node);
    }
    // TODO: consider computed property
    if (ts.isComputedPropertyName(node)) {
      // expect string or symbol literal
      // visitBinding(node.expression);
    }
    if (ts.isBindingElement(node)) {
      visitNamedBinding(node.name);
      if (node.propertyName) {
        visitNamedBinding(node.propertyName);
      }
    }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        visitNamedBinding(element);
      }
    }
  }

  type NamedDeclarationWithModifiers = ts.NamedDeclaration & {
    /**@external*/
    modifiers?: ts.NodeArray<ts.ModifierLike>;
  };
  function hasDeclareOrAbstractModifier<T extends NamedDeclarationWithModifiers | ts.VariableStatement,>(
    node: T,
  ): boolean {
    return (
      node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DeclareKeyword || m.kind === ts.SyntaxKind.AbstractKeyword,
      ) ?? false
    );
  }
}

export function getLocalExportedSymbols(checker: ts.TypeChecker, file: ts.SourceFile): LocalExported {
  const fileSymbol = checker.getSymbolAtLocation(file);
  return {
    symbols: fileSymbol ? checker.getExportsOfModule(fileSymbol) : [],
  };
}

export function createIsBindingExported(
  checker: ts.TypeChecker,
  projectExported: ProjectExported,
  localExported: LocalExported,
) {
  return (binding: BindingNode, isRoot: boolean) => {
    // special case for property assignment
    if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
      const type = checker.getTypeAtLocation(binding.parent);
      if (projectExported.types.includes(type)) {
        return true;
      }
      if (type.symbol && projectExported.symbols.includes(type.symbol)) {
        return true;
      }
      // inferred object type member will skip mangle: ex. const x = {vvv: 1};
      const objectType = checker.getTypeAtLocation(binding.parent.parent);
      if (objectType.symbol?.name === "__object") {
        return true;
      }
    }
    const symbol = checker.getSymbolAtLocation(binding);

    {
      const parent = binding.parent as MangleTargetNode;
      const symbol = checker.getSymbolAtLocation(binding);
      const type = checker.getTypeAtLocation(binding);
      if (projectExported.nodes.includes(parent)) {
        return true;
      }
      if (symbol && projectExported.symbols.includes(symbol)) {
        return true;
      }
      if (type.symbol && projectExported.symbols.includes(type.symbol)) {
        return true;
      }
    }

    // TODO: remove this
    // check local exported
    {
      // checker.getExports
      if (symbol && localExported.symbols.includes(symbol)) {
        return true;
      }
    }
    return false;
  };
}

function isSymbolExported(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const exportedSymbol = checker.getExportSymbolOfSymbol(symbol);
  return exportedSymbol !== symbol;
}

function isSymbolExportedFromRoot(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const exportedSymbol = checker.getExportSymbolOfSymbol(symbol);
  return exportedSymbol !== symbol;
}

export function walkProjectExported(
  checker: ts.TypeChecker,
  exportedFiles: ts.SourceFile[],
  localFiles: ts.SourceFile[],
): ProjectExported {
  const symbolWalker = createGetSymbolWalker(checker)();
  for (const root of exportedFiles) {
    walkRootFile(root);
  }
  for (const file of localFiles) {
    walkTargetFile(file);
  }
  const visited = symbolWalker.getVisited();
  const nodes = visitedToNodes(checker, visited);

  // TODO: check this is correct
  const bindings = nodes.flatMap((node) => findBindingsInFile(node));
  return {
    symbols: visited.symbols,
    types: visited.types,
    nodes,
    bindings,
  } satisfies ProjectExported;

  function walkSymbol(symbol: ts.Symbol) {
    {
      const type = checker.getTypeOfSymbol(symbol);
      symbolWalker.walkSymbol(symbol);
      symbolWalker.walkType(type);
      if (type.symbol) {
        symbolWalker.walkSymbol(type.symbol);
      }
    }
  }

  function walkRootFile(root: ts.SourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(root);
    if (!fileSymbol) return;
    const exportedSymbols = checker.getExportsOfModule(fileSymbol);
    for (const symbol of exportedSymbols) {
      walkSymbol(symbol);
      // check exported
      // if it is any type and export type, typescript was lost type tracing
      // ex. export type { MyType } from "./types";
      if (isSymbolExported(checker, symbol)) continue;
      const exportedSymbol = checker.getExportSymbolOfSymbol(symbol);
      const maybeSpecifier = exportedSymbol?.declarations?.[0];
      if (maybeSpecifier && ts.isExportSpecifier(maybeSpecifier)) {
        const specifierType = checker.getTypeAtLocation(maybeSpecifier);
        symbolWalker.walkType(specifierType);
        specifierType.symbol && symbolWalker.walkSymbol(specifierType.symbol);
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

function visitedToNodes(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  debug: boolean = false,
): MangleTargetNode[] {
  const log = debug ? console.log : () => {};
  const relatedNodes = new Set<MangleTargetNode>();
  for (const symbol of visited.symbols) {
    // register symbol declaration
    for (const declaration of symbol.getDeclarations() ?? []) {
      walkExportedNode(declaration, 0);
    }

    // type inferred nodes
    const type = checker.getTypeOfSymbol(symbol);
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        walkExportedNode(declaration, 0);
      }
      if (type.symbol.valueDeclaration) {
        walkExportedNode(type.symbol.valueDeclaration, 0);
      }
    }
  }

  for (const type of visited.types) {
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        walkExportedNode(declaration, 0);
      }
    }
  }

  return [...relatedNodes];

  function isRelatedNode(node: ts.Node): node is MangleTargetNode {
    return (
      // types
      ts.isTypeNode(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeLiteralNode(node) ||
      // classes
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isPropertySignature(node) ||
      ts.isMethodSignature(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node) ||
      ts.isPropertyAssignment(node) ||
      // advanced type literals
      ts.isIntersectionTypeNode(node) ||
      ts.isUnionTypeNode(node)
    );
  }
  function walkExportedNode(node: ts.Node, depth: number) {
    log(
      "  ".repeat(depth) + "[Related:" + ts.SyntaxKind[node.kind] + "]",
      formatCode(node.getText()).slice(0, 20) + "...",
    );

    if (!isRelatedNode(node)) return;
    if (relatedNodes.has(node)) return;
    relatedNodes.add(node);

    // now only for classes
    const isClassMember = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (ts.isPropertyDeclaration(node) && isClassMember) {
      if (node.type) {
        walkExportedNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (ts.isMethodDeclaration(node) && isClassMember) {
      for (const param of node.parameters) {
        walkExportedNode(param, depth + 1);
      }
      for (const typeParams of node.typeParameters ?? []) {
        walkExportedNode(typeParams, depth + 1);
      }
    }
    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        walkExportedNode(typeParam, depth + 1);
      }
      if (node.type) {
        walkExportedNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          walkExportedNode(type.expression, depth + 1);
        }
      }
      for (const typeParam of node.typeParameters ?? []) {
        walkExportedNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        walkExportedNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        walkExportedNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          walkExportedNode(type.expression, depth + 1);
        }
      }
    }
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        walkExportedNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node) || ts.isPropertySignature(node)) {
      if (node.type) {
        walkExportedNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        walkExportedNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        walkExportedNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      walkExportedNode(node.name, depth + 1);
    }

    // walk types
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        walkExportedNode(type, depth + 1);
      }
    }
  }
}
