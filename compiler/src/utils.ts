import { forEachChild, Node, SourceFile, SyntaxKind } from "typescript";

// from typescript source
/** Returns a token if position is in [start-of-leading-trivia, end), includes JSDoc only in JS files */
export function getNodeAtPosition(
  sourceFile: SourceFile,
  position: number,
): Node {
  let current: Node = sourceFile;
  const getContainingChild = (child: Node) => {
    if (
      child.pos <= position &&
      (position < child.end ||
        (position === child.end && (child.kind === SyntaxKind.EndOfFileToken)))
    ) {
      return child;
    }
  };
  while (true) {
    const child = forEachChild(current, getContainingChild);
    if (!child) {
      return current;
    }
    current = child;
  }
}
