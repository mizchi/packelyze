import ts from "typescript";

// for composeVisitors
export function getEffectDetectorEnter(checker: ts.TypeChecker, onEnter: (node: ts.Node) => void = () => {}) {
  return (node: ts.Node) => {
    if (ts.isBinaryExpression(node)) {
      const isAssign = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (isAssign) {
        const leftType = checker.getTypeAtLocation(node.left);
        if (
          leftType.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile) ||
          leftType.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile
        ) {
          onEnter(node.right);
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const type = checker.getTypeAtLocation(node.expression);
      if (type.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile) {
        for (const typeArg of node.typeArguments ?? []) {
          onEnter(typeArg);
        }
        for (const arg of node.arguments) {
          onEnter(arg);
        }
      }
    }

    // FIXME object spread is unsafe for typescript renamer: like {...obj}
    if (ts.isSpreadAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      onEnter(node.expression);
    }
  };
}
