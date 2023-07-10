import ts from "typescript";

// special comment tags for bundler and terser
// https://github.com/terser/terser#annotations
// https://www.typescriptlang.org/tsconfig#stripInternal
// https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler#type-annotations
export const INTERNAL_TAG = "internal";
export const NO_SIDE_EFFECT_TAG = "#__NO_SIDE_EFFECTS__";
export const PURE_TAG = "__PURE__";
export const INLINE_TAG = "__INLINE__";
export const NOINLINE_TAG = "__NOINLINE__";
export const KEY_TAG = "__KEY__";
export const MANGLE_PROP_TAG = "__MANGLE_PROP__";

export type CommentTag =
  | typeof NO_SIDE_EFFECT_TAG
  | typeof PURE_TAG
  | typeof INTERNAL_TAG
  | typeof INLINE_TAG
  | typeof NOINLINE_TAG
  | typeof KEY_TAG
  | typeof MANGLE_PROP_TAG;

export function getLeadingComments(code: string, stmt: ts.Statement): string[] | undefined {
  const nodeFullStart = stmt.getFullStart();
  const leadingCommentRanges = ts.getLeadingCommentRanges(code, nodeFullStart);
  return leadingCommentRanges?.map((comment) => {
    return code.substring(comment.pos, comment.end);
  });
}

export function getTrailingComments(code: string, stmt: ts.Expression): string[] | undefined {
  const fullStart = stmt.getFullStart();
  const trailingCommentRanges = ts.getTrailingCommentRanges(code, fullStart);
  return trailingCommentRanges?.map((comment) => {
    const text = code.substring(comment.pos, comment.end);
    return text;
  });
}

export function hasCommentTagFromLeading(code: string, stmt: ts.Statement, tag: CommentTag): boolean {
  const comments = getLeadingComments(code, stmt);
  if (!comments) return false;
  const commentTag = tag === INTERNAL_TAG ? `@internal` : tag;
  return comments.some((comment) => comment.includes(commentTag));
}

export function hasCommentTagFromNode(code: string, expr: ts.Expression, tag: CommentTag): boolean {
  const comments = getTrailingComments(code, expr);
  if (!comments) return false;
  const commentTag = tag === INTERNAL_TAG ? `@internal` : tag;
  return comments.some((comment) => comment.includes(commentTag));
}

export function hasCommentTagFromSymbol(symbol: ts.Symbol, tagName: CommentTag) {
  return symbol.getJsDocTags().some((tag) => tag.name === tagName);
}
