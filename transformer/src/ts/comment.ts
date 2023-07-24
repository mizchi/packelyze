import ts from "typescript";
import { BindingAnnotation } from "./types";

// special comment tags for bundler and terser
// https://github.com/terser/terser#annotations
// https://www.typescriptlang.org/tsconfig#stripInternal
// https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler#type-annotations
export const INTERNAL_TAG = "internal";
export const AT_INTERNAL_TAG = "@internal";

// original annotation for stop mangle
export const EXTERNAL_TAG = "external";
export const AT_EXTERNAL_TAG = "@external";

export const SIDE_EFFECT_TAG = "__SIDE_EFFECT__";
export const NO_SIDE_EFFECT_TAG = "__NO_SIDE_EFFECT__";
export const PURE_TAG = "__PURE__";
// export const INLINE_TAG = "__INLINE__";
// export const NOINLINE_TAG = "__NOINLINE__";
// export const KEY_TAG = "__KEY__";
// export const MANGLE_PROP_TAG = "__MANGLE_PROP__";

export function getLeadingComments(stmt: ts.Node, code: string): string[] | undefined {
  const nodeFullStart = stmt.getFullStart();
  const leadingCommentRanges = ts.getLeadingCommentRanges(code, nodeFullStart);
  return leadingCommentRanges?.map((comment) => {
    return code.substring(comment.pos, comment.end);
  });
}

export function getTrailingComments(stmt: ts.Node, code: string): string[] | undefined {
  const fullStart = stmt.getFullStart();
  const trailingCommentRanges = ts.getTrailingCommentRanges(code, fullStart);
  return trailingCommentRanges?.map((comment) => {
    const text = code.substring(comment.pos, comment.end);
    return text;
  });
}

export function getCommentsFromIdentifier(node: ts.Node, code?: string): string[] | undefined {
  code = code ?? node.getSourceFile().getFullText();
  // return getTrailingComments(code, node);

  if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
    return getLeadingComments(node, code);
  }

  // { /*ann*/method() {} }
  if (
    node.parent &&
    ts.isMethodDeclaration(node.parent) &&
    node.parent.name === node &&
    ts.isObjectLiteralExpression(node.parent.parent)
  ) {
    return getLeadingComments(node, code);
  }
  // { /*ann*/method() {} }
  if (
    node.parent &&
    (ts.isMethodSignature(node.parent) || ts.isPropertySignature(node.parent)) &&
    node.parent.name === node &&
    ts.isTypeNode(node.parent.parent)
  ) {
    return getLeadingComments(node, code);
  }

  if (node.parent && ts.isFunctionDeclaration(node.parent) && node.parent.name === node) {
    return getTrailingComments(node, code);
  }

  return [...(getTrailingComments(node, code) ?? []), ...(getLeadingComments(node, code) ?? [])];
}

export function getAnnotationAtNode(
  binding: ts.Identifier | ts.PrivateIdentifier,
  code?: string,
): BindingAnnotation | undefined {
  const comments = getCommentsFromIdentifier(binding, code);
  if (!comments) return;
  const ann: BindingAnnotation = {};
  for (const commentText of comments ?? []) {
    if (commentText.includes(AT_INTERNAL_TAG)) {
      ann.internal = true;
    }
    if (commentText.includes(AT_EXTERNAL_TAG)) {
      ann.external = true;
    }
  }
  return ann;
}
