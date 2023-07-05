import ts from "typescript";

export const symbolToRelatedTypes = (symbol: ts.Symbol, checker: ts.TypeChecker) => {
  const types: ts.Type[] = [];
  if (symbol.declarations) {
    for (const decl of symbol.declarations) {
      const declaredType = checker.getTypeAtLocation(decl);
      if (declaredType == null) continue;
      types.push(declaredType);
    }
  }
  if (symbol.valueDeclaration) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    types.push(type);
  }
  return types;
};

export const symbolToRelatedNodes = (symbol: ts.Symbol): ts.Node[] => {
  const nodes: ts.Node[] = [];
  if (symbol.declarations) {
    for (const decl of symbol.declarations) {
      nodes.push(decl);
    }
  }
  if (symbol.valueDeclaration) {
    nodes.push(symbol.valueDeclaration);
  }
  return nodes;
};
