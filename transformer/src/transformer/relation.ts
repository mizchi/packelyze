import ts from "typescript";
import type { MangleTargetNode as MangleRelatedNode } from "./types";
import { SymbolWalkerResult } from "../typescript/types";
import { formatCode, toReadableSymbol, toReadableType } from "../typescript/utils";

// get local rename candidates
type BindingNode = ts.Identifier | ts.PrivateIdentifier;

export function getBindingsForFile(checker: ts.TypeChecker, file: ts.SourceFile): BindingNode[] {
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
    const isClassMember = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (isClassMember && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
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
    if (ts.isPropertyAssignment(node)) {
      // const parent = node.parent;
      // const parentType = checker.getTypeAtLocation(parent);
      // console.log("<Assignment>", parentType.symbol?.name, parentType && checker.typeToString(parentType));
      // Skip infered type

      // TODO: skip by type.symbol
      // if (parentType.symbol?.name === "__object" || parentType.symbol?.name === "__function") {
      //   visitNamedBinding(node.name);
      // }
      // const type = checker.getTypeAtLocation(node.name);
      // console.log("<Assignment>", type && checker.typeToString(type));
      // throw "stop";
      visitNamedBinding(node.name);
    }
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

export function findRelatedNodes(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  debug: boolean = false,
): MangleRelatedNode[] {
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
      ts.isObjectLiteralExpression(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node) ||
      ts.isPropertyAssignment(node) ||
      ts.isIntersectionTypeNode(node) ||
      ts.isUnionTypeNode(node)
    );
  }
  function visitRelatedNode(node: ts.Node, depth: number) {
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
        visitRelatedNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (isClassMember && ts.isMethodDeclaration(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
      for (const typeParams of node.typeParameters ?? []) {
        visitRelatedNode(typeParams, depth + 1);
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
      // const type = checker.getTypeAtLocation(node);
      // console.log("<ObjectLiteral>", checker.typeToString(type), type.symbol.valueDeclaration?.getFullText());
      // throw "stop";
      // TODO: check type
      for (const prop of node.properties) {
        visitRelatedNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      // const type = checker.getTypeAtLocation(node.name);
      // console.log("<Assignment>", { ...type, checker: null });
      // throw "stop";
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

export function isMangleBinding(
  checker: ts.TypeChecker,
  binding: BindingNode,
  exportedNodes: ts.Node[],
  exportedSymbols: ts.Symbol[],
  exportedTypes: ts.Type[],
) {
  // skip: type <Foo> = { ... }
  if (ts.isTypeAliasDeclaration(binding.parent) && binding.parent.name === binding) {
    return false;
  }
  // skip: interface <Foo>{ ... }
  if (ts.isInterfaceDeclaration(binding.parent) && binding.parent.name === binding) {
    return false;
  }

  // skip inferred type
  if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
    const type = checker.getTypeAtLocation(binding.parent);
    if (exportedTypes.includes(type)) {
      return false;
    }

    if (type.symbol && exportedSymbols.includes(type.symbol)) {
      return false;
    }

    // inferred object type member will skip mangle
    // ex. const x = {vvv: 1};
    const objectType = checker.getTypeAtLocation(binding.parent.parent);
    if (objectType.symbol?.name === "__object") {
      return false;
    }
    // if (objectType.symbol?.name && exportedSymbols.includes(objectType.symbol)) {
    //   return false;
    // }
  }
  const symbol = checker.getSymbolAtLocation(binding);

  // node is related to export
  if (exportedNodes.includes(binding.parent)) {
    // console.log("skip: exported", identifier.text);
    return false;
  }

  // FIXME
  // node is exported
  if (symbol && exportedSymbols.includes(symbol)) {
    return false;
  }
  return true;
}
