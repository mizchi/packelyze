import "../../test/globals";
import { initTestLanguageServiceWithFiles } from "../../test/testHarness";
import { getChangesAfterRename } from "../ts/renamer";
import { expect, test } from "vitest";
import { canNodeRename, expandToSafeRenames, getExportedInProjectCreator, getLocalsInFile } from "./mangler";
import { aggressiveMangleValidator } from "..";
// import { getExportedInProject } from "./relation";

function findRootRelatedNodesForTest(checker: ts.TypeChecker, root: ts.SourceFile) {
  const visited = getExportedInProject(checker, [root], [root]);
  // const walker = createGetSymbolWalker(checker)();
  // const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  // for (const symbol of symbols) {
  //   walker.walkSymbol(symbol);
  // }
  // const visited = walker.getVisited();
  // const nodes = visitedToNodes(checker, visited);
  return {
    nodes: visited.nodes.map((node) => {
      return {
        kind: ts.SyntaxKind[node.kind],
        text: formatCode(node.getText()),
      };
    }),
  };
}

// assert expected mangle results
function assertExpectedMangleResult(entry: string, files: Record<string, string>, expected: Record<string, string>) {
  const { service, normalizePath, projectPath } = initTestLanguageServiceWithFiles(files);
  entry = normalizePath(entry);
  const root = service.getProgram()!.getSourceFile(entry)!;
  const checker = service.getProgram()!.getTypeChecker();
  const isExported = getExportedInProjectCreator(checker, [root], [root], aggressiveMangleValidator);

  // console.log("[root]", root.fileName);
  // throw new Error("Function not implemented.");

  const nodes = [root].flatMap((target) => {
    return getLocalsInFile(target).filter(isExported).filter(canNodeRename);
  });

  const renames = expandToSafeRenames(service.findRenameLocations, nodes);
  const rawChanges = getChangesAfterRename(renames, service.readSnapshotContent, normalizePath);

  // rename for assert
  const changes = rawChanges.map((x) => {
    return {
      fileName: x.fileName.replace(projectPath + "/", ""),
      content: x.content,
    };
  });
  console.log(
    "[changes]",
    // root.fileName,
    // fileNames,
    // targetFiles.map((x) => x.fileName),
    changes.map((x) => x.fileName),
  );

  const diagnostics = service.getProgram()!.getSemanticDiagnostics();
  if (diagnostics.length > 0) {
    console.log(
      "[semantic-diagnostics]]",
      diagnostics.map((x) => x.messageText),
    );
  }

  // expect(changes.length).toBe(Object.keys(expected).length);
  for (const change of changes) {
    const expectedContent = expected[change.fileName];
    expect(change.content).toEqualFormatted(expectedContent);
  }
}

// import { expect, test } from "vitest";
import { createOneshotTestProgram } from "../../test/testHarness";
import ts from "typescript";
import { formatCode, isInferredNode, toReadableNode, toReadableType } from "../ts/tsUtils";
import { getExportedInProject } from "./mangler";

test("findFileBindings # complex", () => {
  const { file, checker } = createOneshotTestProgram(`
  interface X {
    x: number;
  }
  type Y = {
    y: number;
  }
  class Z {
    z: number;
    cf() {}
  }
  const x = 1;
  let y = 2, z = 3;
  const [a, b, c: d] = [1, 2, 3];
  const { i, j: k } = { i: 1, j: 2 };
  function f(param: number) {
    return param;
  }
  function Component({ p: q = 1 }, { p: number } ) {
  }
  type Nested = {
    nested: {
      x: number;
      deep: {
        y: number;
        deepf(): void;
      }
    }
  }
  module M {}
  `);
  const idents = getLocalsInFile(file);

  const expected = new Set([
    "X",
    "Y",
    "Z",
    "x",
    "y",
    "z",
    "a",
    "b",
    "c",
    "d",
    "f",
    "param",
    "Nested",
    "nested",
    "deep",
    "cf",
    "deepf",
    "i",
    "j",
    "k",
    "M",
    "Component",
    "p",
    "q",
  ]);
  for (const ident of idents) {
    expect(expected).includes(ident.getText());
  }
});

test("findFileBindings # PropertyAssignment", () => {
  const { file, checker } = createOneshotTestProgram(`
  const obj = {
    foo: 1,
    nested: {
      bar: 2
    }
  };
  `);
  const bindings = getLocalsInFile(file);
  const expected = new Set(["obj", "foo", "nested", "bar"]);
  for (const ident of bindings) {
    expect(expected).includes(ident.getText());
  }
});

test("findRootRelatedNodes # export", () => {
  const { checker, file } = createOneshotTestProgram(`
  type Hidden = {
    __hidden: number;
  }
  type LocalRef = {
    local: number;
  }
  export type MyType = {
    ref: LocalRef,
    f1(): void;
    f2(): { fx: 1 }
  };
  export const myValue: MyType = { ref: { local: 1 }, f1() {}, f2() { return { fx: 1 } } };
  `);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    { kind: `TypeAliasDeclaration`, text: `export type MyType = { ref: LocalRef, f1(): void; f2(): { fx: 1 } };` },
    { kind: `TypeLiteral`, text: `{ ref: LocalRef, f1(): void; f2(): { fx: 1 } }` },
    { kind: `PropertySignature`, text: `ref: LocalRef,` },
    { kind: `TypeReference`, text: `LocalRef` },
    { kind: `MethodSignature`, text: `f1(): void;` },
    { kind: `MethodSignature`, text: `f2(): { fx: 1 }` },
    { kind: `TypeLiteral`, text: `{ local: number; }` },
    { kind: `PropertySignature`, text: `local: number;` },
    { kind: `NumberKeyword`, text: `number` },
    { kind: `TypeLiteral`, text: `{ fx: 1 }` },
    { kind: `PropertySignature`, text: `fx: 1` },
    { kind: `LiteralType`, text: `1` },
  ]);
});

test("findRootRelatedNodes # union", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    aaa: number;
  };
  type B = {
    bbb: number;
  }
  export type T = {
    union: A | B;
    intersection: A & B;
  };
`);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    {
      kind: "TypeAliasDeclaration",
      text: "export type T = { union: A | B; intersection: A & B; };",
    },
    {
      kind: "TypeLiteral",
      text: "{ union: A | B; intersection: A & B; }",
    },
    { kind: "PropertySignature", text: "union: A | B;" },
    { kind: "UnionType", text: "A | B" },
    { kind: "TypeReference", text: "A" },
    { kind: "TypeReference", text: "B" },
    { kind: "PropertySignature", text: "intersection: A & B;" },
    { kind: "IntersectionType", text: "A & B" },
    { kind: "TypeReference", text: "A" },
    { kind: "TypeReference", text: "B" },
  ]);
});

test("findRootRelatedNodes # as casting", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    aaa: number;
  };
  type B = {
    bbb: number;
  }
  export const a = {
    aaa: 1
  } as A
`);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    {
      kind: "VariableDeclaration",
      text: "a = { aaa: 1 } as A",
    },
    { kind: "TypeLiteral", text: "{ aaa: number; }" },
    { kind: "PropertySignature", text: "aaa: number;" },
    { kind: "NumberKeyword", text: "number" },
  ]);
});

test("findRootRelatedNodes # class", () => {
  const { checker, file } = createOneshotTestProgram(`
  interface I {
    f1(): number;
  }
  export class X implements I {
    f1() {
      return 1;
    }
  }
  `);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    { kind: "ClassDeclaration", text: "export class X implements I { f1() { return 1; } }" },
    {
      kind: "Identifier",
      text: "I",
    },
    { kind: "MethodDeclaration", text: "f1() { return 1; }" },
    { kind: "InterfaceDeclaration", text: "interface I { f1(): number; }" },
    { kind: "MethodSignature", text: "f1(): number;" },
  ]);
});

test("findRootRelatedNodes # infer", () => {
  const { checker, file } = createOneshotTestProgram(`
  const hidden = {
    __hidden: 1,
    __hidden: 2,
  };
  export const obj = {
    foo: 1,
    nested: {
      bar: 2
    }
  };
`);

  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    {
      kind: "VariableDeclaration",
      text: "obj = { foo: 1, nested: { bar: 2 } }",
    },
    {
      kind: "ObjectLiteralExpression",
      text: "{ foo: 1, nested: { bar: 2 } }",
    },
    { kind: "PropertyAssignment", text: "foo: 1" },
    { kind: "Identifier", text: "foo" },
    { kind: "PropertyAssignment", text: "nested: { bar: 2 }" },
    { kind: "Identifier", text: "nested" },
    { kind: "ObjectLiteralExpression", text: "{ bar: 2 }" },
    { kind: "PropertyAssignment", text: "bar: 2" },
    { kind: "Identifier", text: "bar" },
  ]);
});

test("detect mangle nodes", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    av: number;
  };
  export const obj = {
    foo: 1,
    nested: {
      bar: 2
    },
    a: {
      av: 1
    } as A
  };
  `);

  const visited = getExportedInProject(checker, [file], [file]);
  const result = visited.nodes.map((node) => {
    return {
      kind: ts.SyntaxKind[node.kind],
      text: formatCode(node.getText()),
    };
  });
  // console.log(result);
  expect(result).toEqual([
    {
      kind: "VariableDeclaration",
      text: "obj = { foo: 1, nested: { bar: 2 }, a: { av: 1 } as A }",
    },
    {
      kind: "ObjectLiteralExpression",
      text: "{ foo: 1, nested: { bar: 2 }, a: { av: 1 } as A }",
    },
    { kind: "PropertyAssignment", text: "foo: 1" },
    { kind: "Identifier", text: "foo" },
    { kind: "PropertyAssignment", text: "nested: { bar: 2 }" },
    { kind: "Identifier", text: "nested" },
    { kind: "PropertyAssignment", text: "a: { av: 1 } as A" },
    { kind: "Identifier", text: "a" },
    { kind: "ObjectLiteralExpression", text: "{ bar: 2 }" },
    { kind: "PropertyAssignment", text: "bar: 2" },
    { kind: "Identifier", text: "bar" },
    { kind: "TypeLiteral", text: "{ av: number; }" },
    { kind: "PropertySignature", text: "av: number;" },
    { kind: "NumberKeyword", text: "number" },
  ]);
  const result2 = visited.nodes.map((node) => {
    const type = checker.getTypeAtLocation(node);
    return {
      typeName: checker.typeToString(type),
      symbolName: type.symbol?.name,
      inferred: isInferredNode(checker, node),
    };
  });

  expect(result2).toEqual([
    {
      typeName: "{ foo: number; nested: { bar: number; }; a: A; }",
      symbolName: "__object",
      inferred: false,
    },
    {
      typeName: "{ foo: number; nested: { bar: number; }; a: A; }",
      symbolName: "__object",
      inferred: true,
    },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
    {
      typeName: "{ bar: number; }",
      symbolName: "__object",
      inferred: false,
    },
    {
      typeName: "{ bar: number; }",
      symbolName: "__object",
      inferred: false,
    },
    { typeName: "A", symbolName: "__type", inferred: false },
    { typeName: "A", symbolName: "__type", inferred: false },
    {
      typeName: "{ bar: number; }",
      symbolName: "__object",
      inferred: true,
    },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "A", symbolName: "__type", inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
  ]);
});

test.skip("mangle: non-exported nodes", () => {
  const input = {
    "index.ts": `
      type Local = {
        local: number;
      }
      type Pub = {
        pub: number;
      }
      function fff(): Pub {
        const fLocal: Local = {local: 1};
        return {
          pub: fLocal.local
        }
      }
      export const x = fff();
    `,
  };
  const expected = {
    "index.ts": `
      type Local = {
        k: number;
      };
      type Pub = {
        pub: number;
      };
      function j(): Pub {
        const q: Local = { k: 1 };
        return {
          pub: q.k,
        };
      }
      export const x = j();
    `,
  };
  assertExpectedMangleResult("src/index.ts", input, expected);
});

// test("mangle: multi files", () => {
//   const files = {
//     "src/sub.ts": `
//       type SubLocal = {
//         subLocal: number;
//       }
//       const vvv = 1;
//       export const sub: SubLocal = {
//         subLocal: 1
//       };
//     `,
//     "src/index.ts": `
//       import { sub } from "./sub";
//       const indexLocal = 1;
//       export const x = sub.subLocal;
//       `,
//   };

//   const expected = {
//     "src/index.ts": `
//       import { sub } from "./sub";
//       const k = 1;
//       export const x = sub.k;
//     `,
//     "src/sub.ts": `
//       type SubLocal = {
//         k: number;
//       };
//       const x = 1;
//       export const sub: SubLocal = {
//         k: 1,
//       };
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: local object member", () => {
//   const files = {
//     "src/index.ts": `
//       type Local = {
//         xxx: number;
//       };
//       type Pub = {
//         pubv: number;
//       };
//       const loc: Local = { xxx: 1 };
//       const pub: Pub = { pubv: 1 };
//       export { pub };
//     `,
//   };
//   const expected = {
//     "src/index.ts": `
//     type Local = {
//       k: number;
//     };
//     type Pub = {
//       pubv: number;
//     };
//     const x: Local = { k: 1 };
//     const j: Pub = { pubv: 1 };
//     export { j as pub };
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: with complex", () => {
//   const files = {
//     "src/index.ts": `
//       export { sub } from "./sub";
//       export const xxx = 1;
//       export function fff() {}
//       export class Ccc {}
//       export enum Eee {}

//       export type Ttt = number;
//       export interface Iii {}

//       const local = 1;
//       {
//         const nested = 2;
//       }

//       const vvv = 1;
//       const yyy = 2;
//       export {
//         vvv,
//         yyy as zzz
//       }

//     `,
//     "src/sub.ts": `
//       export const sub = 1;
//     `,
//   };
//   const expected = {
//     "src/index.ts": `
//       export { sub } from "./sub";
//       export const xxx = 1;
//       export function fff() {}
//       export class Ccc {}
//       export enum Eee {}
//       export type Ttt = number;
//       export interface Iii {}
//       const k = 1;
//       {
//         const x = 2;
//       }
//       const j = 1;
//       const q = 2;
//       export { j as vvv, q as zzz };
//     `,
//   };
//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: with internal scope", () => {
//   const files = {
//     "src/index.ts": `
//   export function getInternal<T1 extends object>(arg: T1) {
//     type Internal<T1> = { internalPub1: string, internalPub2: T1};
//     type UnusedInternal = { hidden: number };
//     const _hidden: UnusedInternal = {
//       hidden: 1
//     }
//     const internal: Internal<T1> = { internalPub1: "foo", internalPub2: arg };
//     return internal
//   }`,
//   };
//   const expected = {
//     "src/index.ts": `
//     export function getInternal<T1 extends object>(arg: T1) {
//       type Internal<T1> = { internalPub1: string; internalPub2: T1 };
//       type UnusedInternal = { k: number };
//       const x: UnusedInternal = {
//         k: 1,
//       };
//       const j: Internal<T1> = { internalPub1: "foo", internalPub2: arg };
//       return j;
//     }
//     `,
//   };
//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: with partial type", () => {
//   const files = {
//     "src/index.ts": `type Exp = {
//     public: {
//       xxx: number;
//     };
//     priv: {
//       yyy: string;
//     }
//   }
//   export const exp: Exp["public"] = { xxx: 1 };
//   type PubType = {
//     pub: number;
//   }
//   export const pub: PubType = { pub: 1 };
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//       type Exp = {
//         k: {
//           xxx: number;
//         };
//         x: {
//           j: string;
//         };
//       };
//       export const exp: Exp["k"] = { xxx: 1 };
//       type PubType = {
//         pub: number;
//       };
//       export const pub: PubType = { pub: 1 };
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// // FIX: external import
// test.skip("mangle with externals", () => {
//   const files = {
//     "src/index.ts": `
//     import {parseArgs} from "node:util";

//     const allowPositionals = true;
//     export function parse(args: string[]) {
//       return parseArgs({
//         args,
//         allowPositionals,
//         options: {
//           name: {
//             type: "string",
//             alias: "n",
//           }
//         }
//       });
//     }
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//       import { parseArgs } from "node:util";
//       const k = true;
//       export function parse(args: string[]) {
//         return parseArgs({
//           args,
//           allowPositionals: k,
//           options: {
//             name: {
//               type: "string",
//               alias: "n",
//             },
//           },
//         });
//       }
//     `,
//   };
//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: with classes", () => {
//   const files = {
//     "src/index.ts": `
//     type MyType = {
//       pubVal: {
//         pub: number;
//       };
//       privVal: {
//         pv: number;
//       };
//     };
//     export class C {
//       private v: MyType;
//       static sv: number = 1;
//       #hardPriv: number = 2;
//       private static svp: number = 2;
//       static sfoo() {
//         return this.spfoo();
//       }
//       private static spfoo() {
//         return this.svp;
//       }
//       constructor(v: number) {
//         this.#hardPriv;
//         this.v = { pubVal: { pub: v }, privVal: { pv: v + this.#hardPriv } };
//       }
//       public foo() {
//         return this.v.pubVal;
//       }
//       private priv() {
//         return this.v.privVal;
//       }
//     }
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//     type MyType = {
//       k: {
//         pub: number;
//       };
//       x: {
//         j: number;
//       };
//     };
//     export class C {
//       private q: MyType;
//       static sv: number = 1;
//       #z: number = 2;
//       private static p: number = 2;
//       static sfoo() {
//         return this.f();
//       }
//       private static f() {
//         return this.p;
//       }
//       constructor(v: number) {
//         this.#z;
//         this.q = { k: { pub: v }, x: { j: v + this.#z } };
//       }
//       public foo() {
//         return this.q.k;
//       }
//       private y() {
//         return this.q.x;
//       }
//     }
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: with abstract class", () => {
//   const files = {
//     "src/index.ts": `
//     abstract class Base {
//       abstract foo(): number;
//     }
//     export class C extends Base {
//       foo() {
//         return 1;
//       }
//     }
//   `,
//   };

//   const expected = {};
//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: ignore local declare", () => {
//   const files = {
//     "src/index.ts": `
//     declare const vvv: number;
//     declare const aaa: {
//       bbb: number;
//     };
//     declare function fff(): number;
//     declare class Ccc {}
//     declare enum Eee {
//       A,
//       B,
//     }
//     declare module Mmm {
//       export type Foo = {
//         foo: number;
//       }
//       export const mmm = 1;
//     }

//     const zzz = 1;
//     export const yyy = vvv + zzz;
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//     declare const vvv: number;
//     declare const aaa: {
//       bbb: number;
//     };
//     declare function fff(): number;
//     declare class Ccc {}
//     declare enum Eee {
//       A,
//       B,
//     }
//     declare module Mmm {
//       export type Foo = {
//         foo: number;
//       }
//       export const mmm = 1;
//     }
//     const k = 1;
//     export const yyy = vvv + k;
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: keep exported types", () => {
//   const files = {
//     "src/index.ts": `
//     export type Type = {
//       xxx: number;
//     }
//     export interface MyInterface {
//       vvv: number;
//     }
//     export function run() {
//       const v: Type = { xxx: 1 };
//       return v;
//     }
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//     export type Type = {
//       xxx: number;
//     }
//     export interface MyInterface {
//       vvv: number;
//     }
//     export function run() {
//       const k: Type = { xxx: 1 };
//       return k;
//     }
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test("mangle: keep effect nodes", () => {
//   const files = {
//     "src/index.ts": `
//     type BodyType = {
//       xxx: number;
//     };
//     export function run(i: number) {
//       const body: BodyType = { xxx: i };
//       fetch("/xxx", { method: "POST", body: JSON.stringify(body) });
//     }
//   `,
//   };
//   const expected = {
//     "src/index.ts": `
//     type BodyType = {
//       xxx: number;
//     };
//     export function run(i: number) {
//       const k: BodyType = { xxx: i };
//       fetch("/xxx", { method: "POST", body: JSON.stringify(k) });
//     }
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// // TODO: fix project diagnostics
// test.skip("mangle: react components", () => {
//   const files = {
//     "src/index.ts": `export { MyComponent } from "./components";`,
//     "src/components.tsx": `
//     export function MyComponent(props: {
//       foo: number,
//       children: React.ReactNode;
//     }) {
//       return <div>
//         <h1>MyComponent</h1>
//         <div>{props.foo}</div>
//         <div>{props.children}</div>
//       </div>;
//     }
//     `,
//   };
//   const expected = {
//     "src/index.ts": `
//     `,
//     "src/components.tsx": ``,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test.skip("mangle: react components with sub component", () => {
//   const files = {
//     "src/index.ts": `export { MyComponent } from "./components";`,
//     "src/components.tsx": `
//     export function MyComponent(props: {
//       foo: number,
//       children: React.ReactNode;
//     }) {
//       return <div>
//         <h1>MyComponent</h1>
//         <div>{props.foo}</div>
//         <div>{props.children}</div>
//         <SubComponent value={props.foo} />
//       </div>;
//     }

//     function SubComponent(props: {
//       value: number;
//     }) {
//       return <div>
//         <h1>SubComponent</h1>
//         <div>{props.value}</div>
//       </div>;
//     }
//     `,
//   };
//   const expected = {
//     "src/index.ts": `
//     `,
//     "src/components.tsx": ``,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test.skip("mangle: with infer 1", () => {
//   const files = {
//     "src/index.ts": `
//     const vvv = {
//       value: {
//         vvv: 1,
//       }
//     };
//     export const yyy = vvv.value;
//   `,
//   };
//   const expected = {
//     "src/index.ts": `
//     const k = {
//       x: {
//         vvv: 1
//       }
//     };
//     export const yyy = k.x;
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test.skip("mangle: with infer 2", () => {
//   const files = {
//     "src/index.ts": `
//     const ref = {
//       nested: 1
//     }
//     const vvv = {
//       value: {
//         vvv: ref,
//       }
//     };
//     export const yyy = vvv.value;
//   `,
//   };
//   const expected = {
//     "src/index.ts": `
//     const k = {
//       nested: 1,
//     };
//     const x = {
//       j: {
//         vvv: k,
//       },
//     };
//     export const yyy = x.j;
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test.skip("mangle: with infer return type", () => {
//   const files = {
//     "src/index.ts": `
//     const vvv = {
//       value: {
//         vvv: 1,
//       }
//     };
//     export function fff() {
//       return vvv.value;
//     }
//   `,
//   };
//   const expected = {
//     "src/index.ts": `
//     const k = {
//       x: {
//         vvv: 1
//       }
//     };
//     export function fff() {
//       return k.x;
//     };
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// test.skip("mangle (or assert) with infer", () => {
//   const files = {
//     "src/index.ts": `
//     const vvv = {
//       aaa: 1,
//     };
//     export const yyy = vvv.aaa;
//   `,
//   };

//   const expected = {
//     "src/index.ts": `
//     const k = {
//       aaa: 1,
//     };
//     export const yyy = k.aaa;
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

// function debugVisitResult(visited: SymbolWalkerResult) {
//   console.log(
//     "[debug:visited:symbols]",
//     [...visited.symbols].map((s) => {
//       return toReadableSymbol(s);
//     }),
//   );
//   console.log(
//     "[debug:visited:types]",
//     [...visited.types].map((t) => {
//       return toReadableType(t);
//     }),
//   );
// }
