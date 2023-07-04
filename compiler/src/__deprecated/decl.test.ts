import { test, expect } from "vitest";
import ts from "typescript";
import { createOneshotTestProgram, createTestLanguageService } from "../testHarness";

function isTypeInferredFromValueDeclaration(type: ts.Type) {
  return type.symbol?.valueDeclaration === type.symbol?.declarations?.[0];
}

test("check one declaration", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    x: number;
  }
  export const x: X = {
    x: 1,
  };
  `);
  const checker = program.getTypeChecker();
  const decl = (file.statements[1] as ts.VariableStatement).declarationList.declarations[0];
  const symbol = checker.getSymbolAtLocation(decl.name)!;
  expect(symbol.declarations?.length).toBe(1);
  expect(symbol.valueDeclaration).toBeTruthy();
  expect(symbol.declarations?.[0].getText()).toContain("x: X");
  expect(symbol.declarations?.[0].getText()).toContain("x: 1");
  expect(symbol.valueDeclaration === symbol.declarations?.[0]).toBeTruthy();
  const type = checker.getTypeFromTypeNode(decl.type!);
  expect(type.symbol?.declarations?.length).toBe(1);
  expect(type.symbol?.valueDeclaration).toBeFalsy();
  expect(type.symbol?.declarations?.[0].getText()).toContain("x: number");
});

test("check multiple declarations", () => {
  const { program, file } = createOneshotTestProgram(`
  interface X {
    x: number;
  }
  interface X {
    y: number;
  }
  export const x: X = {
    x: 1,
    y: 2,
  };
  `);
  const checker = program.getTypeChecker();
  const decl = (file.statements[2] as ts.VariableStatement).declarationList.declarations[0];
  const symbol = checker.getSymbolAtLocation(decl.name)!;
  // symbol has one declaration
  expect(symbol.declarations?.length).toBe(1);
  expect(symbol.valueDeclaration).toBeTruthy();
  // declaration is the same as valueDeclaration
  expect(symbol.declarations?.[0].getText()).toContain("x: X");
  expect(symbol.declarations?.[0].getText()).toContain("x: 1");
  expect(symbol.declarations?.[0].getText()).toContain("y: 2");
  expect(symbol.valueDeclaration === symbol.declarations?.[0]).toBeTruthy();
  // const symbol = checker.getSymbolAtLocation(decl.type);
  const type = checker.getTypeFromTypeNode(decl.type!);
  // console.log("X", {...type, checker: undefined});
  expect(type.symbol?.declarations?.length).toBe(2);
  // type has no valueDeclaration
  expect(type.symbol?.valueDeclaration).toBeFalsy();
  expect(type.symbol?.declarations?.[0].getText()).toContain("x: number");
  expect(type.symbol?.declarations?.[1].getText()).toContain("y: number");

  expect(isTypeInferredFromValueDeclaration(type)).toBeFalsy();
});

test("check literal type", () => {
  const { program, file } = createOneshotTestProgram(`
  export const x: { x: number } = {
    x: 1,
  };
  `);
  const checker = program.getTypeChecker();
  const decl = (file.statements[0] as ts.VariableStatement).declarationList.declarations[0];
  const symbol = checker.getSymbolAtLocation(decl.name)!;
  expect(symbol.declarations?.length).toBe(1);
  expect(symbol.valueDeclaration).toBeTruthy();
  expect(symbol.declarations?.[0].getText()).toContain("x: 1");
  expect(symbol.valueDeclaration === symbol.declarations?.[0]).toBeTruthy();

  const type = checker.getTypeFromTypeNode(decl.type!);
  expect(type.symbol?.declarations?.length).toBe(1);
  expect(type.symbol?.valueDeclaration).toBeFalsy();
  expect(type.symbol?.declarations?.[0].getText()).toContain("x: number");

  expect(isTypeInferredFromValueDeclaration(type)).toBeFalsy();
});

test("check infered type from value", () => {
  const { program, file } = createOneshotTestProgram(`
  export const x = {
    x: 1,
  };
  `);
  const checker = program.getTypeChecker();

  const decl = (file.statements[0] as ts.VariableStatement).declarationList.declarations[0];
  const symbol = checker.getSymbolAtLocation(decl.name)!;
  expect(symbol.declarations?.length).toBe(1);
  expect(symbol.valueDeclaration).toBeTruthy();
  expect(symbol.declarations?.[0].getText()).toContain("x: 1");
  expect(symbol.valueDeclaration === symbol.declarations?.[0]).toBeTruthy();

  const type = checker.getTypeOfSymbol(symbol);
  expect(type.symbol?.declarations?.length).toBe(1);

  // infered type has valueDeclaration
  expect(type.symbol?.valueDeclaration).toBeTruthy();
  expect(type.symbol?.declarations?.[0].getText()).toContain("x: 1");

  expect(isTypeInferredFromValueDeclaration(type)).toBeTruthy();
});

test("getTypeOfSymbol with cast", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    x: number;
  }
  export const x = {
    x: 1,
  } as X;
`);
  const checker = program.getTypeChecker();
  for (const stmt of file.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.name.getText() === "x") {
          const symbol = checker.getSymbolAtLocation(decl.name)!;
          expect(symbol.declarations?.length).toBe(1);
          expect(symbol.valueDeclaration).toBeTruthy();
          expect(symbol.declarations?.[0].getText()).toContain("x: 1");
          expect(symbol.valueDeclaration === symbol.declarations?.[0]).toBeTruthy();
          // infered type has no type annotation
          expect(decl.type).toBeFalsy();
          const type = checker.getTypeOfSymbol(symbol);
          expect(type.symbol?.declarations?.length).toBe(1);
          expect(type.symbol?.valueDeclaration).toBeFalsy();
          expect(type.symbol?.declarations?.[0].getText()).toContain("x: number");
          expect(type.aliasSymbol).toBeTruthy();
        }
      }
    }
  }
});

test("imported type", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    import { sub } from "./sub";
    export const x = sub;
    `,
  );
  service.writeSnapshotContent(
    normalizePath("src/sub.ts"),
    `
    type Sub = { sub: number }
    export const sub: Sub = { sub: 1 };
    `,
  );
  const program = service.getProgram()!;
  const file = program.getSourceFile(normalizePath("src/index.ts"))!;
  const checker = program.getTypeChecker();
  const subDecl = (file.statements[1] as ts.VariableStatement).declarationList.declarations[0];
  const subSymbol = checker.getSymbolAtLocation(subDecl.name)!;
  const subType = checker.getTypeOfSymbol(subSymbol)!;
  expect(subType.symbol.declarations?.length).toBe(1);
  expect(subType.symbol.valueDeclaration).toBeFalsy();
  expect(subType.symbol).toBeTruthy();
  const subTypeDecl = subType.symbol?.declarations?.[0]!;
  expect(subTypeDecl.getText()).toContain("sub: number");
  expect(subTypeDecl.getSourceFile().fileName).toContain("src/sub.ts");
});
