import ts, { getJSDocTags } from "typescript";
import { expect, test } from "vitest";
import { getFirstNodeFromMatcher } from "./utils";
import {
  NO_SIDE_EFFECT_TAG,
  PURE_TAG,
  getLeadingComments,
  getTrailingComments,
  hasCommentTagFromLeading,
  hasCommentTagFromNode,
  INTERNAL_TAG,
  hasCommentTagFromSymbol,
} from "./comments";
import { createOneshotTestProgram } from "../__tests/testHarness";

test("TS: comments", () => {
  const code = `
  /* stmt-leading */ 
  const x = /* expr */ 42;

  /* stmt-leading1 */
  /* stmt-leading2 */
  const y = 2;

  // line comment
  const z = 3;

  /*#__NO_SIDE_EFFECTS__*/
  function pure() {}

  function impure() {
    globalThis.x = 1;
  }

  const pureVal = /*#__PURE__*/ pure();
  `;

  const file = ts.createSourceFile("test.ts", code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  {
    const node = getFirstNodeFromMatcher(file, /const x/)! as ts.Statement;
    const comments = getLeadingComments(code, node);
    expect(comments).toEqual(["/* stmt-leading */"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /42/)! as ts.Expression;
    const comments = getTrailingComments(code, node);
    expect(comments).toEqual(["/* expr */"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /const y/)! as ts.Statement;
    const comments = getLeadingComments(code, node);
    expect(comments).toEqual(["/* stmt-leading1 */", "/* stmt-leading2 */"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /const z/)! as ts.Statement;
    const comments = getLeadingComments(code, node);
    expect(comments).toEqual(["// line comment"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /function pure/)! as ts.Statement;
    expect(node.kind).toBe(ts.SyntaxKind.FunctionDeclaration);
    expect(hasCommentTagFromLeading(code, node, NO_SIDE_EFFECT_TAG)).toBe(true);
  }
  {
    const node = getFirstNodeFromMatcher(file, /function impure/)! as ts.Statement;
    expect(node.kind).toBe(ts.SyntaxKind.FunctionDeclaration);
    expect(hasCommentTagFromLeading(code, node, NO_SIDE_EFFECT_TAG)).toBe(false);
  }

  {
    // call expression
    const node = getFirstNodeFromMatcher(file, /pure\(\);/)! as ts.CallExpression;
    expect(node.parent.kind).toBe(ts.SyntaxKind.CallExpression);
    const callExpr = node.parent as ts.CallExpression;
    expect(hasCommentTagFromNode(code, callExpr, PURE_TAG)).toBe(true);
  }
});

test("TS: jsdoc", () => {
  const code = `
  /**
   * @type {string}
   */
  export const s = "str";
  /** @internal */
  export const t = "str";
  /*#__NO_SIDE_EFFECTS__*/
  export const u = "str";
  `;
  const { file, checker } = createOneshotTestProgram(code);
  {
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!)[0];
    const jsDocTags = symbol.getJsDocTags();
    expect(hasCommentTagFromSymbol(symbol, INTERNAL_TAG)).toBe(false);
    expect(jsDocTags).toEqual([{ name: "type", text: [{ kind: "text", text: "{string}" }] }]);
  }
  {
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!)[1];
    expect(hasCommentTagFromSymbol(symbol, INTERNAL_TAG)).toBe(true);
  }
  {
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!)[2];
    const jsDocTags = symbol.getJsDocTags();
    expect(jsDocTags).lengthOf(0);
  }
});
