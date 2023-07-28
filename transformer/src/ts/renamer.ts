import ts from "typescript";
import { BatchRenameLocation, FindRenameLocations } from "./types";
import { ChangeResult, FileChangeResult } from "../transform/transformTypes";
import MagicString from "magic-string";
import { SourceMapConsumer, SourceMapGenerator } from "source-map";

/** wrap service.findRenameLocations */
export function findBatchRenameLocations(
  findRenameLocations: FindRenameLocations,
  fileName: string,
  pos: number,
  prefs: ts.UserPreferences = {
    providePrefixAndSuffixTextForRename: true,
    allowRenameOfImportPath: true,
  },
): ts.RenameLocation[] | undefined {
  return findRenameLocations(fileName, pos, false, false, prefs) as BatchRenameLocation[] | undefined;
}

export function getChangesAfterRename(
  renames: BatchRenameLocation[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): FileChangeResult[] {
  // rewire renames by each files
  const fileNames = [...new Set(renames.map((r) => normalizePath(r.fileName)))];
  return fileNames.map((targetFile) => {
    const current = readCurrentFile(targetFile)!;
    const renames = findRenamesForFile(targetFile);
    const result = applyBatchRenameLocations(current, renames);
    return {
      fileName: targetFile,
      content: result.content,
      start: result.start,
      end: result.end,
      map: result.map,
    };
  });

  function findRenamesForFile(fileName: string) {
    return renames
      .filter((r) => normalizePath(r.fileName) === fileName)
      .sort((a, b) => a.textSpan.start - b.textSpan.start);
  }
}

export function applyBatchRenameLocations(
  code: string,
  renames: BatchRenameLocation[],
  smc?: SourceMapConsumer,
  debug = false,
): ChangeResult {
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
  }

  return {
    content: magicString.toString(),
    start: changedStart,
    end: changedEnd,
    map: magicString.generateMap({ includeContent: true, hires: true }).toString(),
  };
}
