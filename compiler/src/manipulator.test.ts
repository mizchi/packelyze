import { expect, test } from "vitest";
import { writeRenamedFileState } from "./manipulator";
import { createTestLanguageService } from "./testHarness";
import { isPreprocessedNeeded, preprocess } from "./transformer/transformer";

test("writeRenamedFileState", () => {
  const { service, normalizePath } = createTestLanguageService();

  const code = `
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
  `;
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    code,
  );
  let source = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;
  if (isPreprocessedNeeded(code)) {
    const pre = preprocess(source);
    service.writeSnapshotContent(
      normalizePath("src/index.ts"),
      pre,
    );
    source = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;
  }
  // const program = service.getProgram()!;

  // const pre = snapshotManager.readFileSnapshot(normalizePath("src/index.ts"));
  // source = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;
  // console.log(source.getText());
  // return;
  writeRenamedFileState(service, source, normalizePath, service.writeSnapshotContent);
  // TODO: Rename fff
  // console.log(
  //   snapshotManager.readFileSnapshot(normalizePath("src/index.ts"))
  // );

  // expect(
  //   snapshotManager.readFileSnapshot(normalizePath("src/index.ts"))
  // ).toBe(`
  //   export const a = 1;
  //   const bbb = 2;
  //   const _ = 3;
  //   {
  //     const $ = 4;
  //     _ = 4;
  //     {
  //       $ = 5;
  //       function fff() {
  //         const b = 6;
  //       }
  //     }
  //   }
  //   export {
  //     bbb
  //   }
  //   `
  // );
});


