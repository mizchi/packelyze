import { expect, test } from "vitest";
import { getRenamedFileState } from "./manipulator";
import { createTestLanguageService } from "./testHarness";

const code = `
import { sub } from "./sub";

const internal = 1;
export const exported = 2;

function f1() {
  const value = 3;
  return { value };
}

// function f2() {
//   f1();
// }

export function g() {
  const g_internal = 4;
  console.log(g_internal);
  // document;
}

console.log(2);
`;

test("getRenamedFileState", () => {
  const { service, snapshotManager, normalizePath } = createTestLanguageService();
  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
    export const a = 1;
    const bbb = 2;
    const ccc = 3;
    {
      const ddd = 4;
      ccc = 4;
      {
        ddd = 5;
        function fff() {
          const eee = 6;
        }
      }
    }
    export {
      bbb
    }
    `
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  // snapshotManager.writeFileSnapshot;
  getRenamedFileState(service, source, normalizePath, snapshotManager.writeFileSnapshot);

  // const [changed, start, end] = [...state.values()][0];

  // TODO: Rename fff
  expect(
    snapshotManager.readFileSnapshot(normalizePath("src/index.ts"))
  ).toBe(`
    export const a = 1;
    const bbb = 2;
    const _ = 3;
    {
      const $ = 4;
      _ = 4;
      {
        $ = 5;
        function fff() {
          const b = 6;
        }
      }
    }
    export {
      bbb
    }
    `
  );
});


