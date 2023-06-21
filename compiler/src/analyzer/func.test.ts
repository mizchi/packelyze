import ts from 'typescript';
import { test, expect } from "vitest";
import { createOneshotTestProgram } from '../testHarness';
import { findClosestBlock } from '../nodeUtils';

test.skip("pure", () => {
  const code = `
  let x = 1;
  function impureCall() {
    console.log("effect", x);
    pureInternal();
    return 1;
  }

  let cnt = 0;
  function pure() {
    cnt++;
    return cnt;
  }
  `;
  const {
    program,
    checker,
    file
  } = createOneshotTestProgram(code);
  // expect(1).toBe(1);
  const func = file.statements[1] as ts.FunctionDeclaration;
  const ret = isPureFunc(checker, func);
  expect(ret).toBe(true);
});

function isPureFunc(checker: ts.TypeChecker, func: ts.FunctionDeclaration | ts.FunctionExpression) {
  const outsideBlock = findClosestBlock(func.parent);
  // const outsideSymbols = checker.getSymbolsInScope(outsideBlock, ts.SymbolFlags.BlockScopedVariable);
  const outsideSymbols = checker.getSymbolsInScope(outsideBlock, ts.SymbolFlags.BlockScoped);
  // const outside = func.parent
  console.log('outside', outsideSymbols.map(s => s.name));
  let outsideRefs: ts.Symbol[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      console.log('internal ident', node.getText());
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol && outsideSymbols.includes(symbol)) {
        outsideRefs.push(symbol);
      }
      // // const symbol = checker.getSymbolAtLocation(node);
      // if (symbol && outsideSymbols.includes(symbol)) {
      //   outsideRefs.push(symbol);
      //   // return false;
      // }
    }
    // if (ts.isCallExpression(node)) {
    //   if (ts.isPropertyAccessExpression(node.expression)) {
    //   }
    //   const symbols = checker.getSymbolsInScope(node, ts.SymbolFlags.FunctionScopedVariable);
    //   console.log(symbols.map(s => s.name));
    // }
    // ts.forEachChild(node, visit);
  };
  ts.forEachChild(func, visit);
  console.log(outsideRefs.map(s => s.name));
  return true;
}

function collectCallHierarchy(checker: ts.TypeChecker, func: ts.FunctionDeclaration | ts.FunctionExpression) {
  const visit: any = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const symbol = checker.getSymbolAtLocation(node.expression);
      console.log(symbol!.name);
    }
    return ts.forEachChild(node, visit);
  };
  ts.forEachChild(func, visit);
  return true;
}