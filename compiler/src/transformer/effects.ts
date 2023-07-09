import ts from "typescript";
export function findSideEffectNodes(checker: ts.TypeChecker, node: ts.Node) {
  const nodes = new Set<ts.Node>();
  const visit = (node: ts.Node) => {
    const targets = enterSideEffectNode(checker, node);
    for (const target of targets) {
      nodes.add(target);
    }
    ts.forEachChild(node, visit);
  };
  visit(node);
  return nodes;
}

export function enterSideEffectNode(checker: ts.TypeChecker, node: ts.Node) {
  const nodes: ts.Node[] = [];
  if (ts.isBinaryExpression(node)) {
    const isAssign = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    if (isAssign) {
      const leftType = checker.getTypeAtLocation(node.left);
      if (
        leftType.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile) ||
        leftType.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile
      ) {
        nodes.push(node.right);
      }
    }
  }
  
  if (ts.isCallExpression(node)) {
    const type = checker.getTypeAtLocation(node.expression);
    if (type.symbol?.valueDeclaration?.getSourceFile().isDeclarationFile) {
      for (const arg of node.arguments) {
        nodes.push(arg);
      }
    }
  }
  return nodes;
}
