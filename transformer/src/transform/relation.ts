import ts from "typescript";
import type { BindingNode, LocalExported, MangleTargetNode, ProjectExported } from "./transformTypes";
import { SymbolWalkerResult } from "../ts/types";
import { composeWalkers, formatCode } from "../ts/tsUtils";
import { getEffectDetectorWalker } from "./detector";
import { createGetSymbolWalker } from "../ts/symbolWalker";

export function findBindingsInFile(file: ts.SourceFile): BindingNode[] {
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
// const fileSymbol = checker.getSymbolAtLocation(file);

// // TODO: remove this
// const localExportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];

export function createIsBindingExported(
  checker: ts.TypeChecker,
  projectExported: ProjectExported,
  localExported: LocalExported,
) {
  return (binding: BindingNode) => {
    // special case for property assignment
    if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
      const type = checker.getTypeAtLocation(binding.parent);
      if (projectExported.types.includes(type)) {
        return true;
      }
      if (type.symbol && localExported.symbols.includes(type.symbol)) {
        return true;
      }
      // inferred object type member will skip mangle: ex. const x = {vvv: 1};
      const objectType = checker.getTypeAtLocation(binding.parent.parent);
      if (objectType.symbol?.name === "__object") {
        return true;
      }
    }

    if (projectExported.nodes.includes(binding.parent as MangleTargetNode)) {
      return true;
    }
    const symbol = checker.getSymbolAtLocation(binding);
    if (symbol && localExported.symbols.includes(symbol)) {
      return true;
    }

    // from type symbol
    const type = checker.getTypeAtLocation(binding);
    if (type.symbol && localExported.symbols.includes(type.symbol)) {
      return true;
    }
    // if (type.symbol && projectExported.symbols.includes(type.symbol)) {
    //   return true;
    // }
    return false;
  };
}

export function walkProjectExported(
  checker: ts.TypeChecker,
  rootFiles: ts.SourceFile[],
  files: ts.SourceFile[],
): ProjectExported {
  const symbolWalker = createGetSymbolWalker(checker)();
  for (const root of rootFiles) {
    walkRootFile(root);
  }
  for (const file of files) {
    walkTargetFile(file);
  }
  const visited = symbolWalker.getVisited();
  return {
    symbols: visited.symbols,
    types: visited.types,
    nodes: visitedToNodes(checker, visited),
  };

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
      walkRelatedNode(declaration, 0);
    }

    // type inferred nodes
    const type = checker.getTypeOfSymbol(symbol);
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        walkRelatedNode(declaration, 0);
      }
      if (type.symbol.valueDeclaration) {
        walkRelatedNode(type.symbol.valueDeclaration, 0);
      }
    }
  }

  for (const type of visited.types) {
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        walkRelatedNode(declaration, 0);
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
  function walkRelatedNode(node: ts.Node, depth: number) {
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
        walkRelatedNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (ts.isMethodDeclaration(node) && isClassMember) {
      for (const param of node.parameters) {
        walkRelatedNode(param, depth + 1);
      }
      for (const typeParams of node.typeParameters ?? []) {
        walkRelatedNode(typeParams, depth + 1);
      }
    }
    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        walkRelatedNode(typeParam, depth + 1);
      }
      if (node.type) {
        walkRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          walkRelatedNode(type.expression, depth + 1);
        }
      }
      for (const typeParam of node.typeParameters ?? []) {
        walkRelatedNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        walkRelatedNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        walkRelatedNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          walkRelatedNode(type.expression, depth + 1);
        }
      }
    }
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        walkRelatedNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node) || ts.isPropertySignature(node)) {
      if (node.type) {
        walkRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        walkRelatedNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        walkRelatedNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      walkRelatedNode(node.name, depth + 1);
    }

    // walk types
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        walkRelatedNode(type, depth + 1);
      }
    }
  }
}
