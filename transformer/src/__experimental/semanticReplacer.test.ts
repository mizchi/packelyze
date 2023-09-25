import ts, { getJSDocTags } from "typescript";
import { test, expect } from "vitest";
import { createOneshotTestProgram } from "../../test/testHarness";
import { cloneNode } from "ts-clone-node";
import { getLeadingComments } from "../ts/comment";

type TransformerProgramFactory<T extends ts.Node = any> = (program: ts.Program) => ts.TransformerFactory<T>;

// TODO: Handle NaN
// TODO: Handle Enum 0
// const truthyLiterals = ["true"];
const falsyLiterals = ["false", "0", "-0", "''", '""', "undefined", "null"];
const isAlwaysFalsyExpression = (checker: ts.TypeChecker, node: ts.Expression) => {
  const expressionType = checker.getTypeAtLocation(node);
  const typeName = checker.typeToString(expressionType);
  // console.log('[expr]', node.getText(),
  //   typeName,
  //   checker.typeToString(
  //     checker.getApparentType(expressionType))
  //   );
  return falsyLiterals.includes(typeName);
};

// TODO: Handle Falsy
const undeterminedLiterals = ["boolean", "number", "string", "Number", "String", "Boolean"];
const isAlwaysTruthyExpression = (checker: ts.TypeChecker, node: ts.Expression) => {
  // skip always falthy
  if (isAlwaysFalsyExpression(checker, node)) return false;
  // skip undetermined primitives
  if (undeterminedLiterals.includes(checker.typeToString(checker.getTypeAtLocation(node)))) return false;
  return true;
};

// TODO: Handle function call
const transformer: TransformerProgramFactory<any> = (program) => (context) => {
  return (sourceFile) => {
    const checker = program.getTypeChecker();
    const visitor: ts.Visitor = (node) => {
      // console.log('[tags]', node.getLeadingTriviaWidth?.()),  getLeadingComments(node, sourceFile.getFullText());
      // console.log('[tags]', ts.getJSDocCommentsAndTags(node)?.[0]?.tags);

      if (ts.isIfStatement(node)) {
        // if (TRUTHY) {/* KEEP */} else {/* DELETE */}
        if (isAlwaysTruthyExpression(checker, node.expression)) {
          // const comment = node.expression.getLeadingTriviaWidth(sourceFile);

          // const symbol = checker.getSymbolAtLocation(node.expression);
          console.log('[tags]',  getLeadingComments(node.expression, sourceFile.getFullText()));
          const cloned = cloneNode(node.thenStatement);
          return ts.visitEachChild(cloned, visitor, context);  
        }
        // if (FALSY) {/* DELETE */} else {/* KEEP */}
        if (isAlwaysFalsyExpression(checker, node.expression)) {
          const cloned = cloneNode(node.elseStatement);
          return ts.visitEachChild(cloned, visitor, context);
        }
      }
      // TRUTHY ? /* KEEP */ : /* DELETE */
      if (ts.isConditionalExpression(node) && isAlwaysTruthyExpression(checker, node.condition)) {
        const cloned = cloneNode(node.whenTrue);
        return ts.visitEachChild(cloned, visitor, context);
      }
      // FALSY ? /* DELETE */ : /* KEEP */
      if (ts.isConditionalExpression(node) && isAlwaysFalsyExpression(checker, node.condition)) {
        const cloned = cloneNode(node.whenFalse);
        return ts.visitEachChild(cloned, visitor, context);
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitEachChild(sourceFile, visitor, context);
  };
};

test("infer to false", () => {
  const { program, file } = createOneshotTestProgram(`
  if (false) { 'ng'; }
  if (false as const) { 'ng'; }
  if (!true) { 'ng'; }
  if (undefined) { 'ng'; }
  if (null) { 'ng'; }
  if (0) { 'ng'; }
  if (-0) { 'ng'; }
  if ('') { 'ng'; }

  const FALSE = false;
  const TRUE = true;
  if (FALSE) { 'ng'; }
  if (TRUE) { 'ok'; }
  if (TRUE || FALSE) { 'ok'; }

  if (({ val: false }).val) { 'ok'; }
  if (({ val: false } as const).val) { 'ng'; }
  `);
  const transformed = ts.transform(file, [transformer(program)]);
  const printer = ts.createPrinter();
  const result = printer.printFile(transformed.transformed[0] as ts.SourceFile);
  // console.log(result);
  expect(result).not.include("ng");
});

test("detect pure expression", () => {
  const { program, file } = createOneshotTestProgram(`
  function pureTrue(): true { return true; }
  function pureFalse(): false { return false; }
  if (/** @__PURE__ */ pureTrue()) { 'ok'; }
  if (/** @__PURE__ */ pureFalse()) { 'ng'; } else { 'ok'; }
  `);
  const transformed = ts.transform(file, [transformer(program)]);
  const printer = ts.createPrinter();
  const result = printer.printFile(transformed.transformed[0] as ts.SourceFile);
  console.log(result);
  // expect(result).not.include("ng");
});

// test("detect pure expression2", () => {
//   const { program, file } = createOneshotTestProgram(`
//   const x = /** @__PURE__ */ Boolean(true);
//   // /** @__NO_SIDE_EFFECT__ */
//   // function pureTrue(): true { return /** @__PURE__ */ Boolean(true); }
//   `);
//   const transformed = ts.transform(file, [transformer(program)]);
//   const printer = ts.createPrinter();
//   const result = printer.printFile(transformed.transformed[0] as ts.SourceFile);
//   console.log(result);
//   // expect(result).not.include("ng");
// });


// if ("a" === "b") { "ng"; }
// if ("a" === "b") { "ng"; }

