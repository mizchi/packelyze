import ts from "typescript";
import MagicString from "magic-string";
import { SourceMapConsumer, SourceMapGenerator } from "source-map";
import { test, expect } from "vitest";

export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};

export function applyBatchRenameLocations(
  code: string,
  renames: BatchRenameLocation[],
  smc?: SourceMapConsumer,
  debug = false,
): { content: string; start: number; end: number; map: string } {
  const debugLog = debug ? console.log : () => {};
  let magicString = new MagicString(code);

  let changedStart = 0;
  let changedEnd = 0;

  for (const rename of renames) {
    const toName = rename.to;
    const start = rename.textSpan.start;
    const end = rename.textSpan.start + rename.textSpan.length;
    debugLog("[name:from]", rename.original, "[name:to]", toName);

    if (changedStart === 0 || changedStart > start) {
      changedStart = start;
    }
    if (changedEnd === 0 || changedEnd < end) {
      changedEnd = end;
    }
    magicString.overwrite(start, end, toName);
  }

  // Apply the existing source map if provided
  if (smc) {
    const s1String = magicString.toString();
    const s2 = SourceMapGenerator.fromSourceMap(smc);
    s2.applySourceMap(smc, s1String, undefined);

    return {
      content: magicString.toString(),
      start: changedStart,
      end: changedEnd,
      map: s2.toString(),
    };
  } else {
    return {
      content: magicString.toString(),
      start: changedStart,
      end: changedEnd,
      map: magicString.generateMap({ includeContent: true, hires: true }).toString(),
    };
  }
}

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
  const smc = await new SourceMapConsumer(result.map);
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
  console.log(renames.map((r) => file.getLineAndCharacterOfPosition(r.textSpan.start)));

  expect(result.content).to.equal(`let x = 1; let y = 2;
x = x + y;
y = x - y;
x = x - y;`);
  const transformedFile = ts.createSourceFile("test.ts", result.content, ts.ScriptTarget.Latest, true);
  const smc = await new SourceMapConsumer(result.map);
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
