import { test, expect } from "vitest";
import {
  createOneshotTestProgram,
  createTestLanguageService,
  initTestLanguageServiceWithFiles,
} from "../../test/testHarness";
import ts from "typescript";
import { getEffectDetectorWalker } from "./detector";
import { composeWalkers, formatCode } from "../ts/tsUtils";
import { getExportedInProject } from "./mangler";

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

test.skip("with no_side_effect for class", () => {
  const { service } = createTestLanguageService();
  service.writeSnapshotContent(
    "src/mylib.d.ts",
    `
    declare class C {
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
