import "../../test/globals";
import { initTestLanguageServiceWithFiles } from "../../test/testHarness";
import { getRenamedFileChanges } from "../ts/renamer";
import { expect, test } from "vitest";
import {
  expandToSafeRenameLocations,
  getCodeActionsFromBindings,
  getExportedInProject,
  getLocalNodesInFile,
} from "./mangler";
// import { getExportedInProject } from "./relation";

// assert expected mangle results
function assertExpectedMangleResult(entry: string, files: Record<string, string>, expected: Record<string, string>) {
  const { service, normalizePath, projectPath } = initTestLanguageServiceWithFiles(files);
  entry = normalizePath(entry);
  const root = service.getProgram()!.getSourceFile(entry)!;
  // const fileNames = service
  //   .getProgram()!
  //   .getRootFileNames()
  //   .filter((fname) => !fname.endsWith(".d.ts"));

  // const targetFiles = fileNames.map((fname) => service.getCurrentSourceFile(fname)!);

  const checker = service.getProgram()!.getTypeChecker();
  const visited = getExportedInProject(checker, [root], [root]);

  const actions = [root].flatMap((target) => {
    const trials = getLocalNodesInFile(checker, visited, target);
    return getCodeActionsFromBindings(checker, trials);
  });

  const renames = expandToSafeRenameLocations(service.findRenameLocations, actions);
  const rawChanges = getRenamedFileChanges(renames, service.readSnapshotContent, normalizePath);

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
