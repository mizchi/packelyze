import ts from "typescript";

export function isSymbolInferredFromValueDeclaration(checker: ts.TypeChecker, symbol: ts.Symbol) {
  const type = checker.getTypeOfSymbol(symbol);
  return isTypeInferredFromValueDeclaration(type);
}

export function isTypeInferredFromValueDeclaration(type: ts.Type) {
  if (type.symbol?.declarations && type.symbol?.declarations.length > 1) {
    return false;
  }
  return type.symbol?.valueDeclaration === type.symbol?.declarations?.[0];
}
