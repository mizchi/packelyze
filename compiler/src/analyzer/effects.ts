import ts from "typescript";
export function findSideEffectSymbols(checker: ts.TypeChecker, node: ts.Node) {
  const nodes = new Set<ts.Node>();

  const visit = (node: ts.Node) => {
    // globalThis.xxx = t;
    if (ts.isBinaryExpression(node)) {
      const isAssign = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (isAssign) {
        const leftType = checker.getTypeAtLocation(node.left);
        if (
          leftType.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile) ||
          leftType.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile
        ) {
          nodes.add(node.right);
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const type = checker.getTypeAtLocation(node.expression);
      if (type.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile) {
        for (const arg of node.arguments) {
          nodes.add(arg);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(node);
  return nodes;
}
