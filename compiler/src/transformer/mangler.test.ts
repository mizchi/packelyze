import "../__tests/globals";
import { createOneshotTestProgram, initTestLanguageServiceWithFiles } from "../__tests/testHarness";
import { RenameItem, findRenameItems, getRenamedChanges } from "./renamer";
import { createSymbolBuilder } from "./symbolBuilder";
import { expect, test } from "vitest";
import {
  expandRenameActionsToSafeRenameItems,
  findDeclarationsFromSymbolWalkerVisited,
  findMangleNodes,
  getLocalBindings,
  getMangleNodes,
  getMangleActionFromNode,
  walkRelatedNodesFromRoot,
} from "./mangler";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import ts from "typescript";
import { findSideEffectSymbols } from "./effects";

// assert expected mangle results
function assertExpectedMangleResult(entry: string, files: Record<string, string>, expected: Record<string, string>) {
  const { service, normalizePath, projectPath } = initTestLanguageServiceWithFiles(files);
  const targets = Object.keys(files).map(normalizePath);
  entry = normalizePath(entry);
  const root = service.getProgram()!.getSourceFile(entry)!;
  const fileNames = service.getProgram()!.getRootFileNames();

  const checker = service.getProgram()!.getTypeChecker();
  const symbolWalker = createGetSymbolWalker(checker)();
  const symbolBuilder = createSymbolBuilder();

  walkRelatedNodesFromRoot(checker, symbolWalker, root);
  // walk all files
  for (const fname of fileNames) {
    const file = service.getCurrentSourceFile(fname)!;
    const effectNodes = findSideEffectSymbols(checker, file);
    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        symbolWalker.walkSymbol(symbol);
      }
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }
  
  const visited = symbolWalker.getVisited();
  const nodes = targets.flatMap((target) => {
    symbolBuilder.reset();
    const file = service.getCurrentSourceFile(target)!;
    return getMangleNodes(checker, visited, file);
  });
  const actions =  [...nodes].flatMap((node) => {
    return getMangleActionFromNode(checker, symbolBuilder, node);
  });
  const items = expandRenameActionsToSafeRenameItems(service.findRenameLocations, actions);
  const rawChanges = getRenamedChanges(items, service.readSnapshotContent, normalizePath);

  // rename for assert
  const changes = rawChanges.map((x) => {
    return {
      fileName: x.fileName.replace(projectPath + "/", ""),
      content: x.content,
    };
  });

  // console.log(
  //   "[semantic-diagnostics]]",
  //   service
  //     .getProgram()!
  //     .getSemanticDiagnostics()
  //     .map((x) => x.messageText), 
  // );

  expect(service.getProgram()!.getSemanticDiagnostics().length).toBe(0);

  expect(changes.length).toBe(Object.keys(expected).length);
  for (const change of changes) {
    const expectedContent = expected[change.fileName];
    expect(change.content).toEqualFormatted(expectedContent);
  }
}

test("find all declarations", () => {
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
  // const checker = program.getTypeChecker();

  const idents = getLocalBindings(checker, file);

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
  // expect(expected).includes
  for (const ident of idents) {
    expect(expected).includes(ident.getText());
  }
});

test("mangle", () => {
  const input = {
    "src/index.ts": `
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
    "src/index.ts": `
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

test("mangle: multi files", () => {
  const files = {
    "src/sub.ts": `
      type SubLocal = {
        subLocal: number;
      }
      const vvv = 1;
      export const sub: SubLocal = {
        subLocal: 1
      };
    `,
    "src/index.ts": `
      import { sub } from "./sub";
      const indexLocal = 1;
      export const x = sub.subLocal;
      `,
  };

  const expected = {
    "src/index.ts": `
      import { sub } from "./sub";
      const j = 1;
      export const x = sub.k;
    `,
    "src/sub.ts": `
      type SubLocal = {
        k: number;
      };
      const x = 1;
      export const sub: SubLocal = {
        k: 1,
      };
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("rename local object member", () => {
  const { service, normalizePath } = initTestLanguageServiceWithFiles({
    "src/index.ts": `
      type Local = {
        xxx: number;
      }; 
      type Pub = {
        pubv: number;
      };
      const loc: Local = { xxx: 1 };
      const pub: Pub = { pubv: 1 };
      export { pub };  
    `,
  });
  const file = service.getCurrentSourceFile("src/index.ts")!;
  const checker = service.getProgram()!.getTypeChecker();

  const symbolWalker = createGetSymbolWalker(checker)();
  // const exportedNodes = findExportedNodesFromRoot(checker, symbolWalker, file);
  const exporteedSymbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const symbol of exporteedSymbol) {
    symbolWalker.walkSymbol(symbol);
  }

  const exportedNodes = findDeclarationsFromSymbolWalkerVisited(symbolWalker.getVisited());

  // const nodes = findMangleNodes(checker, file, exporteedSymbol);
  const nodes = findMangleNodes(checker, file, exportedNodes);
  const symbolBuilder = createSymbolBuilder();

  // const item
  const items: RenameItem[] = [...nodes].flatMap((node) => {
    const action = getMangleActionFromNode(checker, symbolBuilder, node);
    const renames = findRenameItems(
      service.findRenameLocations,
      file.fileName,
      action.start,
      action.original,
      action.to,
    );
    return renames ?? [];
  });

  const newState = getRenamedChanges(items, service.readSnapshotContent, normalizePath);
  for (const content of newState) {
    service.writeSnapshotContent(content.fileName, content.content);
  }
  const newFile = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;
  const result = newFile.getText();

  expect(result).toEqualFormatted(`
  type Local = {
    k: number;
  };
  type Pub = {
    pubv: number;
  };
  const x: Local = { k: 1 };
  const j: Pub = { pubv: 1 };
  export { j as pub };
  `);
});

test("mangle with complex", () => {
  // const { service, normalizePath } = createTestLanguageService();

  const files = {
    "src/index.ts": `
      export { sub } from "./sub";
      export const xxx = 1;
      export function fff() {}
      export class Ccc {}
      export enum Eee {}

      export type Ttt = number;
      export interface Iii {}

      const local = 1;
      {
        const nested = 2;
      }

      const vvv = 1;
      const yyy = 2;
      export {
        vvv,
        yyy as zzz
      }

    `,
    "src/sub.ts": `
      export const sub = 1;
    `,
  };
  const expected = {
    "src/index.ts": `
      export { sub } from "./sub";
      export const xxx = 1;
      export function fff() {}
      export class Ccc {}
      export enum Eee {}
      export type Ttt = number;
      export interface Iii {}
      const k = 1;
      {
        const x = 2;
      }
      const j = 1;
      const q = 2;
      export { j as vvv, q as zzz };
    `,
  };
  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("mangle with scope internal", () => {
  const files = {
    "src/index.ts": `
  export function getInternal<T1 extends object>(arg: T1) {
    type Internal<T1> = { internalPub1: string, internalPub2: T1};
    type UnusedInternal = { hidden: number };
    const _hidden: UnusedInternal = {
      hidden: 1
    }
    const internal: Internal<T1> = { internalPub1: "foo", internalPub2: arg };
    return internal
  }`,
  };
  const expected = {
    "src/index.ts": `
    export function getInternal<T1 extends object>(arg: T1) {
      type Internal<T1> = { internalPub1: string; internalPub2: T1 };
      type UnusedInternal = { k: number };
      const x: UnusedInternal = {
        k: 1,
      };
      const j: Internal<T1> = { internalPub1: "foo", internalPub2: arg };
      return j;
    }
    `,
  };
  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("mangle with partial type", () => {
  const files = {
    "src/index.ts": `type Exp = {
    public: {
      xxx: number;
    };
    priv: {
      yyy: string;
    }
  }
  export const exp: Exp["public"] = { xxx: 1 };
  type PubType = {
    pub: number;
  }
  export const pub: PubType = { pub: 1 };
  `,
  };

  const expected = {
    "src/index.ts": `
      type Exp = {
        k: {
          xxx: number;
        };
        x: {
          j: string;
        };
      };
      export const exp: Exp["k"] = { xxx: 1 };
      type PubType = {
        pub: number;
      };
      export const pub: PubType = { pub: 1 };
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

// FIX: external import
test.skip("mangle with externals", () => {
  const files = {
    "src/index.ts": `
    import {parseArgs} from "node:util";

    const allowPositionals = true;
    export function parse(args: string[]) {
      return parseArgs({
        args,
        allowPositionals,
        options: {
          name: {
            type: "string",
            alias: "n",
          }
        }
      });
    }
  `,
  };

  const expected = {
    "src/index.ts": `
      import { parseArgs } from "node:util";
      const k = true;
      export function parse(args: string[]) {
        return parseArgs({
          args,
          allowPositionals: k,
          options: {
            name: {
              type: "string",
              alias: "n",
            },
          },
        });
      }  
    `,
  };
  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("mangle with externals", () => {
  const files = {
    "src/index.ts": `
    type MyType = {
      pubVal: {
        pub: number;
      };
      privVal: {
        pv: number;
      };
    };
    export class C {
      private v: MyType;
      static sv: number = 1;
      #hardPriv: number = 2;
      private static svp: number = 2;
      static sfoo() {
        return this.spfoo();
      }
      private static spfoo() {
        return this.svp;
      }
      constructor(v: number) {
        this.#hardPriv;
        this.v = { pubVal: { pub: v }, privVal: { pv: v + this.#hardPriv } };
      }
      public foo() {
        return this.v.pubVal;
      }
      private priv() {
        return this.v.privVal;
      }
    }      
  `,
  };

  const expected = {
    "src/index.ts": `
    type MyType = {
      k: {
        pub: number;
      };
      x: {
        j: number;
      };
    };
    export class C {
      private q: MyType;
      static sv: number = 1;
      #z: number = 2;
      private static p: number = 2;
      static sfoo() {
        return this.f();
      }
      private static f() {
        return this.p;
      }
      constructor(v: number) {
        this.#z;
        this.q = { k: { pub: v }, x: { j: v + this.#z } };
      }
      public foo() {
        return this.q.k;
      }
      private y() {
        return this.q.x;
      }
    }
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("ignore local declare", () => {
  const files = {
    "src/index.ts": `
    declare const vvv: number;
    declare const aaa: {
      bbb: number;
    };
    declare function fff(): number;
    declare class Ccc {}
    declare enum Eee {
      A,
      B,
    }
    declare module Mmm {
      export type Foo = {
        foo: number;
      }
      export const mmm = 1;
    }

    const zzz = 1;
    export const yyy = vvv + zzz;
  `,
  };

  const expected = {
    "src/index.ts": `
    declare const vvv: number;
    declare const aaa: {
      bbb: number;
    };
    declare function fff(): number;
    declare class Ccc {}
    declare enum Eee {
      A,
      B,
    }
    declare module Mmm {
      export type Foo = {
        foo: number;
      }
      export const mmm = 1;
    }
    const k = 1;
    export const yyy = vvv + k;
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("keep types", () => {
  const files = {
    "src/index.ts": `
    export type Type = {
      xxx: number;
    }
    export interface MyInterface {
      vvv: number;
    }
    export function run() {
      const v: Type = { xxx: 1 };
      return v;
    }
  `,
  };

  const expected = {
    "src/index.ts": `
    export type Type = {
      xxx: number;
    }
    export interface MyInterface {
      vvv: number;
    }
    export function run() {
      const k: Type = { xxx: 1 };
      return k;
    }
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

test("keep sideEffect types", () => {
  const files = {
    "src/index.ts": `
    type BodyType = {
      xxx: number;
    };
    export function run(i: number) {
      const body: BodyType = { xxx: i };
      fetch("/xxx", { method: "POST", body: JSON.stringify(body) });
    }
  `,
  };
  const expected = {
    "src/index.ts": `
    type BodyType = {
      xxx: number;
    };
    export function run(i: number) {
      const k: BodyType = { xxx: i };
      fetch("/xxx", { method: "POST", body: JSON.stringify(k) });
    }
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});

// interface I {
//   f1(): number;
// }
// export class C implements I {
//   f1() {
//     return 1;
//   }
// }

// interface I {
//   f1(): number;
// }
// export class C implements I {
//   f1(): number {
//     const v = 1;
//     return v;
//   }
// }

// interface I {
//   f1: () => number;
// }
// export class C implements I {
//   f1() {
//     // const v = 1;
//     return 1;
//   }
// }

// test.only("keep sideEffect types", () => {
//   const files = {
//     "src/index.ts": `
//     interface I {
//       v: number;
//     }
//     export class MyClass implements I {
//       v: number = 1;
//     }
//   `,
//   };
//   const expected = {
//     "src/index.ts": `
//     `,
//   };

//   assertExpectedMangleResult("src/index.ts", files, expected);
// });

test("nodeWalker", () => {
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
  const walker = createGetSymbolWalker(checker)();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const symbol of symbols) {
    walker.walkSymbol(symbol);
  }
  const visited = walker.getVisited();
  const collected = findDeclarationsFromSymbolWalkerVisited(visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + format(node.getText());
    }),
  ).toEqual([
    `(TypeAliasDeclaration)export type MyType = { ref: LocalRef, f1(): void; f2(): { fx: 1 } };`,
    `(TypeLiteral){ ref: LocalRef, f1(): void; f2(): { fx: 1 } }`,
    "(PropertySignature)ref: LocalRef,",
    "(TypeReference)LocalRef",
    "(MethodSignature)f1(): void;",
    "(MethodSignature)f2(): { fx: 1 }",
    "(PropertySignature)local: number;",
    "(NumberKeyword)number",
    "(PropertySignature)fx: 1",
    "(LiteralType)1",
  ]);
});

test("nodeWalker #2 class", () => {
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
  const walker = createGetSymbolWalker(checker)();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const symbol of symbols) {
    walker.walkSymbol(symbol);
  }
  const visited = walker.getVisited();
  const decls = findDeclarationsFromSymbolWalkerVisited(visited);
  expect(
    [...decls].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + format(node.getText());
    }),
  ).toEqual([
    "(ClassDeclaration)export class X implements I { f1() { return 1; } }",
    "(MethodDeclaration)f1() { return 1; }",
    "(InterfaceDeclaration)interface I { f1(): number; }",
    "(MethodSignature)f1(): number;",
  ]);
});

function format(code: string) {
  return code.replace(/[\s\n]+/g, " ").trim().trimEnd();
}

test.skip("mangle (or assert) with infer", () => {
  const files = {
    "src/index.ts": `
    const vvv = {
      aaa: 1,
    };
    export const yyy = vvv.aaa;
  `,
  };

  const expected = {
    "src/index.ts": `
    const k = {
      x: 1,
    };
    export const yyy = k.x;
    `,
  };

  assertExpectedMangleResult("src/index.ts", files, expected);
});
