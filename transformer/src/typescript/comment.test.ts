import ts, { getJSDocTags } from "typescript";
import { expect, test } from "vitest";
import { getFirstNodeFromMatcher } from "./tsUtils";
import { getLeadingComments, getTrailingComments, getCommentsFromIdentifier, getAnnotationsAtNode } from "./comment";
import { createOneshotTestProgram } from "../../test/testHarness";

test("TS: comments", () => {
  const code = `
  /* stmt-leading */ 
  const x = /* expr */ 42;

  /* stmt-leading1 */
  /* stmt-leading2 */
  const y = 2;

  // line comment
  const z = 3;

  /*#__NO_SIDE_EFFECT__*/
  function pure() {}

  function impure() {
    globalThis.x = 1;
  }

  const pureVal = /*#__PURE__*/ pure();

  class Foo {
    /* @internal */
    classFunc() {
      return 1;
    }
  }
  `;

  const file = ts.createSourceFile("test.ts", code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  {
    const node = getFirstNodeFromMatcher(file, /const x/)!;
    expect(node.kind).toBe(ts.SyntaxKind.VariableDeclarationList);
    expect(ts.isStatement(node)).toBe(false);
    // expect(getTrailingComments(code, node)).toEqual(["/* stmt-leading */"]);
    expect(getLeadingComments(node, code)).toEqual(["/* stmt-leading */"]);
    for (const child of (node as ts.VariableDeclarationList).declarations) {
      expect(getLeadingComments(child, code)).toEqual(undefined);
    }
  }
  {
    const node = getFirstNodeFromMatcher(file, /42/)!;
    expect(node.kind).toBe(ts.SyntaxKind.NumericLiteral);
    expect(ts.isExpression(node)).toBe(true);
    expect(getTrailingComments(node, code)).toEqual(["/* expr */"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /const y/)!;
    expect(node.kind).toBe(ts.SyntaxKind.VariableDeclarationList);
    expect(getLeadingComments(node, code)).toEqual(["/* stmt-leading1 */", "/* stmt-leading2 */"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /const z/)!;
    expect(getLeadingComments(node, code)).toEqual(["// line comment"]);
  }
  {
    const node = getFirstNodeFromMatcher(file, /function pure/)! as ts.Statement;
    expect(node.kind).toBe(ts.SyntaxKind.FunctionDeclaration);
  }
  {
    const node = getFirstNodeFromMatcher(file, /function impure/)! as ts.Statement;
    expect(node.kind).toBe(ts.SyntaxKind.FunctionDeclaration);
  }
  {
    // call expression
    const node = getFirstNodeFromMatcher(file, /pure\(\);/)!;
    expect(node.parent.kind).toBe(ts.SyntaxKind.CallExpression);
    const callExpr = node.parent as ts.CallExpression;
  }
  {
    const node = getFirstNodeFromMatcher(file, /classFunc/)!;
    expect(node.parent.kind).toBe(ts.SyntaxKind.MethodDeclaration);
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
  /*#__NO_SIDE_EFFECT__*/
  export const u = "str";
  `;
  const { file, checker } = createOneshotTestProgram(code);
  {
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!)[0];
    const jsDocTags = symbol.getJsDocTags();
    // expect(hasCommentTagFromSymbol(symbol, INTERNAL_TAG)).toBe(false);
    expect(jsDocTags).toEqual([{ name: "type", text: [{ kind: "text", text: "{string}" }] }]);
  }
  {
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!)[2];
    const jsDocTags = symbol.getJsDocTags();
    expect(jsDocTags).lengthOf(0);
  }
});

test("getCommentsFromNode # 1", () => {
  const code = `
  const /*@internal*/ v = 42;
  interface I {
    /*@internal*/ iv: string;
    /*@internal*/ ifunc(): void;
  }
  type T = {
    /*@internal*/ tv: string;
    /*@internal*/ tfunc(): void;
  }
  class /*@internal*/C {
    public /*@internal*/ cv = 1;
    async /*@internal*/ cfunc() {}
  }
  const obj = {
    /*@internal*/ov: 1,
    /*@internal*/ofunc() {},
  };

  function /*@internal*/ fff() {
  }
  `;

  const file = ts.createSourceFile("test.ts", code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  const matchers = [/v =/, /C \{/, /cv/, /cfunc/, /ov/, /ofunc/, /tv/, /tfunc/, /fff/];
  for (const matcher of matchers) {
    const node = getFirstNodeFromMatcher(file, matcher)!;
    expect(node.kind).toBe(ts.SyntaxKind.Identifier);
    // console.log("next matcher", matcher, ts.SyntaxKind[node.kind], node.getText());
    expect(getCommentsFromIdentifier(node)).toEqual(["/*@internal*/"]);
  }
});

test("getAnnotationsAtBinding # 1", () => {
  const code = `
  const /*@internal*/ v = 42;
  interface I {
    /*@internal*/ iv: string;
    /*@internal*/ ifunc(): void;
  }
  type T = {
    /*@internal*/ tv: string;
    /*@internal*/ tfunc(): void;
  }
  class /*@internal*/C {
    public /*@internal*/ cv = 1;
    async /*@internal*/ cfunc() {}
  }
  const obj = {
    /*@internal*/ov: 1,
    /*@internal*/ofunc() {},
  };

  function /*@internal*/ fff() {
  }
  `;

  const file = ts.createSourceFile("test.ts", code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  const matchers = [/v =/, /C \{/, /cv/, /cfunc/, /ov/, /ofunc/, /tv/, /tfunc/, /fff/];
  for (const matcher of matchers) {
    const node = getFirstNodeFromMatcher(file, matcher)!;
    expect(node.kind).toBe(ts.SyntaxKind.Identifier);
    expect(getAnnotationsAtNode(node as ts.Identifier)).toEqual({
      internal: true,
    });
  }
});
