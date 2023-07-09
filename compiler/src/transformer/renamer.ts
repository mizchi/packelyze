import ts from "typescript";
import { FindRenameLocations } from "../typescript/types";

export type BatchRenameItem = ts.RenameLocation & {
  original: string;
  to: string;
};

type FileChangeResult = {
  fileName: string;
  content: string;
  start?: number;
  end?: number;
};

/** wrap service.findRenameLocations */
export function findRenameItems(
  // service: ts.LanguageService,
  findRenameLocations: FindRenameLocations,
  fileName: string,
  pos: number,
  original: string,
  to: string,
  prefs: ts.UserPreferences = {
    providePrefixAndSuffixTextForRename: true,
    allowRenameOfImportPath: true,
  },
): BatchRenameItem[] | undefined {
  const renames = findRenameLocations(fileName, pos, false, false, prefs) as BatchRenameItem[] | undefined;
  if (!renames) return;
  // check is export related
  for (const rename of renames) {
    rename.original = original;
    rename.to = `${rename.prefixText ?? ""}${to}${rename.suffixText ?? ""}`;
  }
  return renames;
}

export function getRenamedFileChanges(
  renames: BatchRenameItem[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): FileChangeResult[] {
  // rewire renames by each files
  const targetFiles = new Set(renames.map((r) => normalizePath(r.fileName)));
  const rewiredRenames: Map<string, BatchRenameItem[]> = new Map();
  for (const targetFile of targetFiles) {
    const sortedRenames: BatchRenameItem[] = renames
      .filter((r) => normalizePath(r.fileName) === targetFile)
      .sort((a, b) => a.textSpan.start - b.textSpan.start);
    rewiredRenames.set(targetFile, sortedRenames);
  }

  // get unique files
  const results: FileChangeResult[] = [];
  for (const [fileName, renames] of rewiredRenames.entries()) {
    const targetFile = fileName;
    const current = readCurrentFile(targetFile)!;
    const [renamed, changedStart, changedEnd] = applyBatchRenameItems(current, renames);
    results.push({ fileName: targetFile, content: renamed, start: changedStart, end: changedEnd });
  }
  return results;
}

export function applyBatchRenameItems(
  code: string,
  renames: BatchRenameItem[],
  debug = false,
): [renamed: string, changedStart: number, changedEnd: number] {
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
  return [current, changedStart, changedEnd];
}
