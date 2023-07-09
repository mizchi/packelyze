import ts from "typescript";
import { composeVisitors } from "../nodeUtils";
export function findEffectNodes(checker: ts.TypeChecker, node: ts.Node) {
  const nodes = new Set<ts.Node>();
  const enter = getEffectDetectorEnter(checker, (node) => {
    nodes.add(node);
  });
  const composed = composeVisitors(enter);
  composed(node);
  return nodes;
}

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
        for (const arg of node.arguments) {
          onEnter(arg);
        }
      }
    }
  };
}
