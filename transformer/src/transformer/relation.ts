import ts from "typescript";
import type { MangleTargetNode as MangleRelatedNode } from "./types";
import { SymbolWalkerResult } from "../typescript/types";

export function isMangleIdentifier(
  checker: ts.TypeChecker,
  identifier: ts.Identifier | ts.PrivateIdentifier,
  exportedNodes: ts.Node[],
  exportedSymbols: ts.Symbol[],
) {
  // skip: type <Foo> = { ... }
  if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
    return false;
  }
  // skip: interface <Foo>{ ... }
  if (ts.isInterfaceDeclaration(identifier.parent) && identifier.parent.name === identifier) {
    return false;
  }

  // node is related to export
  if (exportedNodes.includes(identifier.parent)) {
    // console.log("skip: exported", identifier.text);
    return false;
  }

  // FIXME
  // node is exported
  const symbol = checker.getSymbolAtLocation(identifier);
  if (symbol && exportedSymbols.includes(symbol)) {
    return false;
  }
  return true;
}

// get local rename candidates
type BindingIdentifier = ts.Identifier | ts.PrivateIdentifier;
export function getBindingsForFile(file: ts.SourceFile): BindingIdentifier[] {
  const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];
  ts.forEachChild(file, visit);
  return identifiers;
  function visit(node: ts.Node) {
    // console.log("[bindings]", ts.SyntaxKind[node.kind], "\n" + node.getText());
    if (ts.isVariableStatement(node) && hasDeclareOrAbstract(node)) {
      // stop if declare const ...
      return;
    }
    // only for classes
    // ObjectLiteral's methodDeclaration will be broken
    const isParentClass = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (isParentClass && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
      if (hasDeclareOrAbstract(node)) return;
      visitNamedBinding(node.name);
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)
    ) {
      if (hasDeclareOrAbstract(node)) return;
      if (node.name) {
        visitNamedBinding(node.name);
      }
    }

    // named binding
    if (
      ts.isVariableDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      visitNamedBinding(node.name);
    }
    // nameable node
    if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
      if (node.name) {
        visitNamedBinding(node.name);
      }
    }
    // TODO: activate for infered nodes
    // if (ts.isPropertyAssignment(node)) {
    //   visitBinding(node.name);
    // }
    ts.forEachChild(node, visit);
  }
  function visitNamedBinding(
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
      visitNamedBinding(node.name);
      if (node.propertyName) {
        visitNamedBinding(node.propertyName);
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        visitNamedBinding(element);
      }
    }
    if (ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        visitNamedBinding(element);
      }
    }
  }
  function hasDeclareOrAbstract(
    node:
      | ts.VariableStatement
      | ts.FunctionDeclaration
      | ts.ClassDeclaration
      | ts.ModuleDeclaration
      | ts.EnumDeclaration
      | ts.MethodDeclaration
      | ts.PropertyDeclaration,
  ): boolean {
    return (
      node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DeclareKeyword || m.kind === ts.SyntaxKind.AbstractKeyword,
      ) ?? false
    );
  }
}

export function findRelatedNodes(visited: SymbolWalkerResult, debug: boolean = false): MangleRelatedNode[] {
  const log = debug ? console.log : () => {};
  const relatedNodes = new Set<MangleRelatedNode>();
  for (const symbol of visited.symbols) {
    for (const declaration of symbol.getDeclarations() ?? []) {
      visitRelatedNode(declaration, 0);
    }
  }

  for (const type of visited.types) {
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        visitRelatedNode(declaration, 0);
      }
    }
  }

  return [...relatedNodes];
  function isRelatedNode(node: ts.Node): node is MangleRelatedNode {
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
      ts.isSetAccessor(node) ||
      ts.isIntersectionTypeNode(node) ||
      ts.isUnionTypeNode(node)
    );
  }
  function visitRelatedNode(node: ts.Node, depth: number) {
    log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

    if (!isRelatedNode(node)) return;
    if (relatedNodes.has(node)) return;
    relatedNodes.add(node);

    // now only for classes
    const isClassParent = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (ts.isPropertyDeclaration(node) && isClassParent) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (ts.isMethodDeclaration(node) && isClassParent) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }

    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitRelatedNode(type.expression, depth + 1);
        }
      }
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        visitRelatedNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitRelatedNode(type.expression, depth + 1);
        }
      }
    }
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitRelatedNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node)) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isPropertySignature(node)) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isGetAccessor(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        visitRelatedNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      visitRelatedNode(node.name, depth + 1);
    }

    // walk types
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        visitRelatedNode(type, depth + 1);
      }
    }
  }
}
