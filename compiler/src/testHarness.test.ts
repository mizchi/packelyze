import { expect, test } from "vitest";
import { createOneshotTestProgram } from "./testHarness";

test("oneshot", () => {
  const code = `export const num: string = 1;`;
  const { program: project, file } = createOneshotTestProgram(code);
  expect(file.getText()).toBe(`export const num: string = 1;`);
  expect(project.getSemanticDiagnostics(file).length).toBe(1);
  {
    // next
    const { program: project, file } = createOneshotTestProgram(`export const num: number = 1;`);
    expect(file.getText()).toBe(`export const num: number = 1;`);
    expect(project.getSemanticDiagnostics(file).length).toBe(0);
  }
});
