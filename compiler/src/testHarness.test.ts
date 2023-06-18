import { expect, test } from "vitest"
import { createOneshotTestProject } from "./testHarness";

test("oneshot", () => {
  const code = `export const num: string = 1;`
  const {project, file} = createOneshotTestProject(code);
  expect(file.getText()).toBe(`export const num: string = 1;`);
  expect(project.getSemanticDiagnostics(file).length).toBe(1);
  {
    // next
    const {project, file} = createOneshotTestProject(`export const num: number = 1;`);
    expect(file.getText()).toBe(`export const num: number = 1;`);
    expect(project.getSemanticDiagnostics(file).length).toBe(0);
  }
});