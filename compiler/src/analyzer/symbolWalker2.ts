// from typescript/src/compiler/symbolWalker.ts

import ts from "typescript";
import { createLogger } from "../logger";

// does not work: inifinite loop
export type CollectorCache = {
  visitedSymbols: Set<ts.Symbol>;
  visitedTypes: Set<ts.Type>;
  visitedNodes: Set<ts.Node>;
};

export function getSymbolWalker(checker: ts.TypeChecker, cache?: CollectorCache, debug = false) {
  const log = createLogger("[symbol-walker]", debug);

  const visitedSymbols = cache ? new Set(cache.visitedSymbols) : new Set<ts.Symbol>();
  const visitedTypes = cache ? new Set(cache.visitedTypes) : new Set<ts.Type>();
  const visitedNodes = cache ? new Set(cache.visitedNodes) : new Set<ts.Node>();

  return {
    getCache: () => {
      return {
        visitedSymbols,
        visitedTypes,
        visitedNodes,
      };
    },
    getNewTypes: () => {
      const newTypes = new Set<ts.Type>();
      for (const type of visitedTypes) {
        if (!cache?.visitedTypes.has(type)) {
          newTypes.add(type);
        }
      }
      return newTypes;
    },
    getNewSymbols: () => {
      const newSymbols = new Set<ts.Symbol>();
      for (const symbol of visitedSymbols) {
        if (!cache?.visitedSymbols.has(symbol)) {
          newSymbols.add(symbol);
        }
      }
      return newSymbols;
    },
    getNewNodes: () => {
      const newNodes = new Set<ts.Node>();
      for (const node of visitedNodes) {
        if (!cache?.visitedNodes.has(node)) {
          newNodes.add(node);
        }
      }
      return newNodes;
    },
    // getNewTypes: () => visitedTypes,
    getRelatedSymbols: () => visitedSymbols,
    getRelatedNodes: () => visitedNodes,
    isRelated,
    isRelatedNode,
    isRelatedSymbol,
    isRelatedType,
    visitNode,
    visitType,
    visitSymbol,
  };

  function isRelatedNode(node: ts.Node) {
    // console.log("isRelatedNode", ts.SyntaxKind[node.kind], node.getText().slice(0, 10));
    if (ts.isPropertySignature(node.parent) && node.parent.type) {
      return isRelated(node.parent.type);
    }
    if (ts.isMethodSignature(node.parent) && node.parent.type) {
      return isRelated(node.parent.type);
    }
    const symbol = checker.getSymbolAtLocation(node);
    const type = checker.getTypeAtLocation(node);
    if (symbol) {
      return isRelated(symbol, type, node);
    } else {
      return isRelated(type, node);
    }
  }

  function isRelatedSymbol(symbol: ts.Symbol) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const node = symbol.valueDeclaration;

    return isRelated(symbol, type, ...[
      ...node ? [node] : [],
      ...symbol.declarations ? symbol.declarations : [],
    ]);
  }
  function isRelatedType(type: ts.Type) {
    return visitedTypes.has(type);
  }

  function isRelated(...symbols: Array<ts.Symbol | ts.Type | ts.Node>) {
    return symbols.some(symbol => visitedSymbols.has(symbol as ts.Symbol) || visitedTypes.has(symbol as ts.Type) || visitedNodes.has(symbol as ts.Node));
  }

  function visitNode(node: ts.Node, depth = 0) {
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);
    log("  ".repeat(depth), "[node]", ts.SyntaxKind[node.kind], node.getText().slice(0, 10));
    // ts.forEachChild(node, (node => visitNode(node, depth + 1)));
    const type = checker.getTypeAtLocation(node);
    visitType(type, depth + 1);

    const symbol = checker.getSymbolAtLocation(node);
    symbol && visitSymbol(symbol, depth + 1);
  }
  function visitType(node: ts.Type, depth = 0) {
    if (visitedTypes.has(node)) return;
    visitedTypes.add(node);
    log("  ".repeat(depth), "[type]", checker.typeToString(node));

    const type = node;
    if (node.symbol) {
      visitSymbol(node.symbol, depth + 1);
    }

    if (type.aliasSymbol) {
      visitSymbol(type.aliasSymbol, depth + 1);
      for (const typeArg of type.aliasTypeArguments ?? []) {
        visitType(typeArg, depth + 1);
      }
    }
    for (const typeArg of type.aliasTypeArguments ?? []) {
      visitType(typeArg);
    }
    if (type.isUnion()) {
      for (const t of type.types) {
        visitType(t, depth + 1);
      }
    }
    if (type.isIntersection()) {
      for (const t of type.types) {
        visitType(t, depth + 1);
      }
    }

    // if (type.isClassOrInterface()) {
    //   const baseType = checker.getBaseTypeOfLiteralType(type);
    //   if (baseType) {
    //     visitType(baseType, depth + 1);
    //   }
    //   if (type.thisType) {
    //     visitType(type.thisType, depth + 1);
    //   }
    // }

    for (const property of type.getProperties()) {
      visitSymbol(property, depth + 1);
    };

    // traverse type object member declarations
    // if (type.flags & ts.TypeFlags.Object) {
    //   const objectType = type as ts.ObjectType;
    //   const objectFlags = objectType.objectFlags;
    //   if (objectFlags & ts.ObjectFlags.Reference) {
    //     const referenceType = objectType as ts.TypeReference;
    //     // TODO: check node
    //     const decl = referenceType.target;
    //     const node = referenceType.node;
    //   }
    //   // visitTypeReference(type as ts.TypeReference);
    // }

    for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
      // const typePredicate = checker.getTypePredicateOfSignature(signature);
      // if (typePredicate?.type) {
      //   visitType(typePredicate.type, depth + 1);
      // }
      // debugLog("  ".repeat(depth), "[CallSignature]");
      // const nextDebug = debug;
      for (const param of signature.parameters) {
        visitSymbol(param, depth + 1);
      }
      for (const typeParam of signature.typeParameters ?? []) {
        visitType(typeParam, depth + 2);
      }
      const returnType = checker.getReturnTypeOfSignature(signature);
      visitType(returnType, depth + 1);
      // debugLog("  ".repeat(depth + 1), "[ReturnType]", checker.typeToString(returnType));
      // traverse(returnType, depth + 2, nextDebug);
    }

    const indexType = checker.getIndexTypeOfType(type, ts.IndexKind.String);
    if (indexType) {
      visitType(indexType, depth + 1);
    }
    const numberIndexType = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (numberIndexType) {
      visitType(numberIndexType, depth + 1);
    }
  }
  function visitSymbol(symbol: ts.Symbol, depth = 0) {
    if (visitedSymbols.has(symbol)) return;
    visitedSymbols.add(symbol);

    log("  ".repeat(depth), "[symbol]", symbol.name);
    if (symbol.valueDeclaration) {
      visitNode(symbol.valueDeclaration, depth + 1);
    }
    for (const decl of symbol.declarations ?? []) {
      visitNode(decl, depth + 1);
    }

    const type = checker.getTypeOfSymbol(symbol);
    visitType(type, depth + 1);

    const exportedSymbols = checker.getExportsOfModule(symbol);
    for (const symbol of exportedSymbols) {
      visitSymbol(symbol, depth + 1);
    }

    const declaredType = checker.getDeclaredTypeOfSymbol(symbol);
    visitType(declaredType, depth + 1);

    // const type = checker.
  }
}
