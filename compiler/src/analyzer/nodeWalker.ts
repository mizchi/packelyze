import ts from "typescript";
import type { SymbolWalkerVisited } from "./symbolWalker";

type VisitableNode =
  | ts.TypeLiteralNode
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.MethodDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isVisitableNode(node: ts.Node): node is VisitableNode {
  return (
    ts.isTypeNode(node) ||
    ts.isTypeLiteralNode(node) ||
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

    if (!isVisitableNode(node)) return;
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);
    // if (ts.isTypeNode(node)) {
    //   // const type = checker.getTypeFromTypeNode(node);
    //   // visitType(type, depth + 1);
    // }

    // skip prorperty assignment. it will be renamed by property signature

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
  }
}
