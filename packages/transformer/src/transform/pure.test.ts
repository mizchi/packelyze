import ts from "typescript";
import { expect, test } from "vitest";
import {
  createOneshotTestProgram,
  createTestLanguageService,
  initTestLanguageServiceWithFiles,
} from "../../test/testHarness";
import { composeWalkers, formatCode } from "../ts/tsUtils";
import { getExportedInProject } from "./mangler";
import { getEffectDetectorWalker } from "./pure";

export function findEffectNodes(checker: ts.TypeChecker, node: ts.Node) {
  const nodes = new Set<ts.Node>();
  const file = node.getSourceFile();
  const enter = getEffectDetectorWalker(checker, file, (node) => {
    nodes.add(node);
  });
  const composed = composeWalkers(enter);
  composed(node);
  return nodes;
}

test("with no_side_effect", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/mylib.d.ts",
    `
  /**#__NO_SIDE_EFFECT__*/
  export declare function pure(a: any): void;
  export declare function impure(a: any): void;
`,
  );
  service.writeSnapshotContent(
    "src/index.ts",
    `
  import {pure, impure} from "./mylib";
  const obj1: {$x: number} = {$x: 1};
  pure(obj1);

  const obj2: {y: number} = {y: 1};
  impure(obj2);
  `,
  );

  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const checker = service.getProgram()!.getTypeChecker();
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "Not include obj1").toEqual(["obj2: {y: number} = {y: 1}", "{y: number}", "y: number", "number"]);
});

test("with no_side_effect for class", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/mylib.d.ts",
    `
    export declare class C {
      /**#__NO_SIDE_EFFECT__*/
      pure(a: any): void;
      impure(a: any): void;
    }
    `,
  );
  service.writeSnapshotContent(
    "src/index.ts",
    `
  import {C} from "./mylib";
  const c = new C();

  const obj1: {$x: number} = {$x: 1};
  c.pure(obj1);

  const obj2: {y: number} = {y: 1};
  c.impure(obj2);
  `,
  );

  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const checker = service.getProgram()!.getTypeChecker();
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "Not include obj1").toEqual(["obj2: {y: number} = {y: 1}", "{y: number}", "y: number", "number"]);
});

test("with no_side_effect for type", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/mylib.d.ts",
    `
    export declare type MyType = {
      /**#__NO_SIDE_EFFECT__*/
      pure(a: any): void;
      impure(a: any): void;
    }
    `,
  );
  service.writeSnapshotContent(
    "src/index.ts",
    `
    import type { MyType } from "./mylib";
    const c: MyType = {
      pure(a: any): void {},
      impure(a: any): void {},
    };

    const obj1: {$x: number} = {$x: 1};
    c.pure(obj1);

    const obj2: {y: number} = {y: 1};
    c.impure(obj2);
    `,
  );

  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const checker = service.getProgram()!.getTypeChecker();
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "Not include obj1").toEqual(["obj2: {y: number} = {y: 1}", "{y: number}", "y: number", "number"]);
});

test("with no_side_effect for PropertySignature", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/mylib.d.ts",
    `
    export declare type MyType = {
      /**#__NO_SIDE_EFFECT__*/
      pure: (a: any) => void;
      impure: (a: any) => void;
    }
    `,
  );
  service.writeSnapshotContent(
    "src/index.ts",
    `
    import type { MyType } from "./mylib";
    const c: MyType = {
      pure(a: any): void {},
      impure(a: any): void {},
    };

    const obj1: {$x: number} = {$x: 1};
    c.pure(obj1);

    const obj2: {y: number} = {y: 1};
    c.impure(obj2);
    `,
  );

  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const checker = service.getProgram()!.getTypeChecker();
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "Not include obj1").toEqual(["obj2: {y: number} = {y: 1}", "{y: number}", "y: number", "number"]);
});

test("with builtin pure func", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/index.ts",
    `
    type Out = {
      $out: number;
    }
    function f(): Promise<Out> {
      return Promise.resolve({$out: 1});
    }
    export const ret = (await f()).$out;
    `,
  );

  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "not include obj").toEqual(["ret = (await f()).$out"]);
});

// TODO: should keep caller expr but ignore types
test.skip("with builtin pure with higher", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/index.ts",
    `
    type Out = {
      $out: number;
    }
    function f(): Promise<Out> {
      return new Promise((resolve, reject) => {
        resolve({$out: 1});
      });
    }
    export const ret = (await f()).$out;
    `,
  );

  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;
  const out = getExportedInProject(checker, [file], [file]);
  const codes = out.nodes.map((node) => {
    return formatCode(node.getText());
  });
  expect(codes, "not include obj").toEqual(["ret = (await f()).$out"]);
});

test("effect with builtins", () => {
  const { checker, file } = createOneshotTestProgram(`
  type Ref1 = { local: number };
  const ref1: Ref1 = { local: 1 };
  const x = JSON.stringify(ref1);
  type Ref2 = {
    xxx: {
      yyy: number
    }
  };
  const ref2: Ref2  = { xxx: {yyy: 1} };
  const y = JSON.stringify(ref2.xxx);
  export {}
`);

  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    "(VariableDeclaration)ref1: Ref1 = { local: 1 }",
    "(TypeLiteral){ local: number }",
    "(PropertySignature)local: number",
    "(NumberKeyword)number",
    "(TypeLiteral){ yyy: number }",
    "(PropertySignature)yyy: number",
    "(NumberKeyword)number",
  ]);
});

test("effect to global assign", () => {
  const { service } = initTestLanguageServiceWithFiles({
    "src/env.d.ts": `
    declare const MyGlobal: {
      myValue: {
        x: number;
      };
    };
    `,
    "src/index.ts": `
  type Value = {
    x: number;
  };
  const t: Value = { x: 1 };
  MyGlobal.myValue = t;
`,
  });
  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;
  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    "(VariableDeclaration)t: Value = { x: 1 }",
    `(TypeLiteral){ x: number; }`,
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
  ]);
});

test("detect object rest spread", () => {
  const { service } = initTestLanguageServiceWithFiles({
    "src/index.ts": `
  type Foo = {
    x: number;
    y: number;
  }
  type Bar = {
    x: number;
  }
  const bar: Bar = {
    x: 1
  };
  export const foo: Foo = {
      ...bar,
      y: 2
  };
    `,
  });
  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    "(VariableDeclaration)foo: Foo = { ...bar, y: 2 }",
    "(TypeLiteral){ x: number; y: number; }",
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
    "(PropertySignature)y: number;",
    "(NumberKeyword)number",
    "(VariableDeclaration)bar: Bar = { x: 1 }",
    "(TypeLiteral){ x: number; }",
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
  ]);
});
