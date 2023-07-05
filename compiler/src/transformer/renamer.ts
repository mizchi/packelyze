import ts from "typescript";
import { TraverseableNode } from "../nodeUtils";

export type RenameItem = ts.RenameLocation & {
  source: string;
  to: string;
};

export type ScopedSymbol = {
  symbol: ts.Symbol;
  parentBlock: TraverseableNode;
  isExportRelated?: boolean;
};

export type FindRenameLocations = ts.LanguageService["findRenameLocations"];

/** wrap service.findRenameLocations */
export function collectRenameItems(
  // service: ts.LanguageService,
  findRenameLocations: FindRenameLocations,
  file: ts.SourceFile,
  pos: number,
  original: string,
  to: string,
  prefs: ts.UserPreferences = {
    providePrefixAndSuffixTextForRename: true,
    allowRenameOfImportPath: true,
  },
): RenameItem[] | undefined {
  const renames = findRenameLocations(file.fileName, pos, false, false, prefs) as RenameItem[] | undefined;
  if (!renames) return;
  // check is export related
  for (const rename of renames) {
    rename.source = original;
    rename.to = `${rename.prefixText ?? ""}${to}${rename.suffixText ?? ""}`;
  }
  return renames;
}

export type ChangedItem = {
  fileName: string;
  content: string;
  start?: number;
  end?: number;
};
export function getRenamedChanges(
  renames: RenameItem[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): ChangedItem[] {
  // rewire renames by each files
  const targetFiles = new Set(renames.map((r) => normalizePath(r.fileName)));
  const rewiredRenames: Map<string, RenameItem[]> = new Map();
  for (const targetFile of targetFiles) {
    const sortedRenames: RenameItem[] = renames
      .filter((r) => normalizePath(r.fileName) === targetFile)
      .sort((a, b) => a.textSpan.start - b.textSpan.start);
    rewiredRenames.set(targetFile, sortedRenames);
  }

  // get unique files
  const contents: ChangedItem[] = [];
  // const changes = new Map<string, [changed: string, start: number, end: number]>();
  // const applied: RenameApplied[] = [];
  for (const [fileName, renames] of rewiredRenames.entries()) {
    const targetFile = fileName;
    const current = readCurrentFile(targetFile)!;
    const [renamed, changedStart, changedEnd] = applyRewiredRenames(current, renames);
    contents.push({ fileName: targetFile, content: renamed, start: changedStart, end: changedEnd });
    // changes.set(targetFile, [renamed, changedStart, changedEnd]);
    // applied.push({ fileName: targetFile, content: renamed, start: changedStart, end: changedEnd });
  }
  return contents;
}

export function applyRewiredRenames(
  code: string,
  renames: RenameItem[],
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
    debugLog("[name:from]", rename.source, "[name:to]", toName);

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
