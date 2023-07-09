import ts from "typescript";
import { FindRenameLocations } from "../typescript/types";
import { BatchRenameLocation, FileChangeResult } from "./types";

/** wrap service.findRenameLocations */
export function findBatchRenameLocations(
  findRenameLocations: FindRenameLocations,
  fileName: string,
  pos: number,
  original: string,
  to: string,
  prefs: ts.UserPreferences = {
    providePrefixAndSuffixTextForRename: true,
    allowRenameOfImportPath: true,
  },
): BatchRenameLocation[] | undefined {
  const renames = findRenameLocations(fileName, pos, false, false, prefs) as BatchRenameLocation[] | undefined;
  if (!renames) return;
  return renames.map((r) => {
    const toWithPrefixAndSuffix = `${r.prefixText ?? ""}${to}${r.suffixText ?? ""}`;
    return {
      ...r,
      original,
      to: toWithPrefixAndSuffix,
    };
  });
}

export function getRenamedFileChanges(
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
      ...result,
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
  debug = false,
): Omit<FileChangeResult, "fileName"> {
  const debugLog = debug ? console.log : () => {};
  // const debugLog = console.log;
  let current = code;
  let offset = 0;
  let changedStart = 0;
  let changedEnd = 0;
  for (const rename of renames) {
    // const loc = rename.location;
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
    current = current.slice(0, start + offset) + toName + current.slice(end + offset);
    offset += toName.length - (end - start);
  }
  return {
    content: current,
    start: changedStart,
    end: changedEnd,
  };
}
