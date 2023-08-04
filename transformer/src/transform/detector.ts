import ts from "typescript";
import { getAnnotationAtNode } from "../ts/comment";

// for composeVisitors
export function getEffectDetectorWalker(checker: ts.TypeChecker, onEnter: (node: ts.Node) => void = () => {}) {
  return (node: ts.Node) => {
    if (ts.isBinaryExpression(node)) {
      // TODO: other modifing opertors
      const modifying = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (modifying) {
        // TODO: right node
        const leftType = checker.getTypeAtLocation(node.left);
        if (leftType.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile)) {
          onEnter(node.right);
        }
      }
    }
    // call external calling is not safe for mangle
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

// for composeVisitors
export function getExternalDetectorWalker(onEnter: (node: ts.Node) => void = () => {}) {
  return (node: ts.Node) => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const ann = getAnnotationAtNode(node);
      if (ann?.external) {
        onEnter(node);
      }
    }
  };
}
