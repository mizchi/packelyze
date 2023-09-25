import { SourceMapConsumer } from "source-map";
import ts from "typescript";
import { expect, test } from "vitest";
import { applyBatchRenameLocations } from "./renamer";

export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};

function getOriginalPositionFromTSPosition(smc: SourceMapConsumer, file: ts.SourceFile, position: number) {
  const p = file.getLineAndCharacterOfPosition(position);
  const originalPosition = smc.originalPositionFor({ line: p.line + 1, column: p.character });
  // const generated = smc.generatedPositionFor({
  //   source: originalPosition.source,
  //   line: p.line + 1, column: p.character,
  // });
  return originalPosition;
}

test("should rename and generate correct source map", async () => {
  const code = "let foo = 1; foo = 2;";
  const renames: BatchRenameLocation[] = [
    {
      fileName: "test.ts",
      textSpan: { start: 4, length: 3 },
      original: "foo",
      to: "bar",
    },
    {
      fileName: "test.ts",
      textSpan: { start: 13, length: 3 },
      original: "foo",
      to: "bar",
    },
  ];

  const result = applyBatchRenameLocations(code, renames);

  expect(result.content).to.equal("let bar = 1; bar = 2;");
  const smc = await new SourceMapConsumer(result.map!);
  const originalPosition1 = smc.originalPositionFor({ line: 1, column: 4 });
  expect(originalPosition1.line).to.equal(1);
  expect(originalPosition1.column).to.equal(4);

  const originalPosition2 = smc.originalPositionFor({ line: 1, column: 13 });
  expect(originalPosition2.line).to.equal(1);
  expect(originalPosition2.column).to.equal(13);
});

test.skip("should rename multiple locations and generate correct source map", async () => {
  const code = `let foo = 1; let bar = 2;
foo = foo + bar;
bar = foo - bar;
foo = foo - bar;`;
  const renames: BatchRenameLocation[] = [
    ...[...code.matchAll(/foo/g)].map((matched) => {
      const start = matched.index as number;
      const text = matched[0] as string;
      return {
        fileName: "test.ts",
        textSpan: { start, length: text.length },
        original: text,
        to: "x",
      };
    }),
    ...[...code.matchAll(/bar/g)].map((matched) => {
      const start = matched.index as number;
      const text = matched[0] as string;
      return {
        fileName: "test.ts",
        textSpan: { start, length: text.length },
        original: text,
        to: "y",
      };
    }),
  ].sort((a, b) => a.textSpan.start - b.textSpan.start);
  const result = applyBatchRenameLocations(code, renames);
  const file = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
  // console.log(renames.map((r) => file.getLineAndCharacterOfPosition(r.textSpan.start)));

  expect(result.content).to.equal(`let x = 1; let y = 2;
x = x + y;
y = x - y;
x = x - y;`);
  const transformedFile = ts.createSourceFile("test.ts", result.content, ts.ScriptTarget.Latest, true);
  const smc = await new SourceMapConsumer(result.map!);
  expect(renames.map((r) => getOriginalPositionFromTSPosition(smc, transformedFile, r.textSpan.start))).toEqual([
    { source: ".", line: 1, column: 4, name: null },
    { source: ".", line: 1, column: 21, name: null },
    { source: ".", line: 2, column: 6, name: null },
    { source: ".", line: 2, column: 16, name: null },
    { source: ".", line: 3, column: 9, name: null },
    { source: ".", line: 3, column: 16, name: null },
    { source: ".", line: 4, column: 9, name: null },
    { source: ".", line: 4, column: 15, name: null },
    { source: ".", line: 4, column: 15, name: null },
    { source: ".", line: 4, column: 15, name: null },
    { source: ".", line: 4, column: 15, name: null },
  ]);
});
