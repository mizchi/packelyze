import ts from "typescript";
import { getNodeAtPosition } from "./nodeUtils";

export type RenameLocationWithMeta = ts.RenameLocation & {
  isShorthand?: boolean;
  isExportedSpecifier?: boolean;
  original: string;
  to: string;
};

// export type BatchRenameItem = {
//   original: string;
//   to: string;
//   locations: readonly RenameLocationWithMeta[];
// };

// export type RewiredRenameItem = {
//   original: string;
//   to: string;
//   location: RenameLocationWithMeta;
// };

/** wrap service.findRenameLocations */
export function findRenameDetails(
  service: ts.LanguageService,
  file: ts.SourceFile,
  pos: number,
  prefs: ts.UserPreferences = {},
): RenameLocationWithMeta[] | undefined {
  const renames = service.findRenameLocations(
    file.fileName,
    pos,
    false,
    false,
    prefs,
  ) as RenameLocationWithMeta[] | undefined;
  if (renames == null) {
    return;
  }

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  // check is export related
  for (const rename of renames) {
    const targetNode = getNodeAtPosition(file, rename.textSpan.start);
    if (checker.getShorthandAssignmentValueSymbol(targetNode.parent) != null) {
      rename.isShorthand = true;
    }
    if (ts.isExportSpecifier(targetNode.parent) && targetNode.parent.propertyName == null) {
      rename.isExportedSpecifier = true;
    }
  }
  return renames;
}

export function getRenameAppliedState(
  renames: RenameLocationWithMeta[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): Map<string, [changed: string, start: number, end: number]> {
  // rewire renames by each files
  const targetFiles = new Set(
    renames.map((r) => normalizePath(r.fileName))
  );
  const rewiredRenames: Map<string, RenameLocationWithMeta[]> = new Map();
  for (const targetFile of targetFiles) {
    const sortedRenames: RenameLocationWithMeta[] = renames
      .filter((r) => normalizePath(r.fileName) === targetFile)
      .sort((a, b) => a.textSpan.start - b.textSpan.start);
    rewiredRenames.set(targetFile, sortedRenames);
  }

  // get unique files
  const changes = new Map<
    string,
    [changed: string, start: number, end: number]
  >();
  for (const [fileName, renames] of rewiredRenames.entries()) {
    const targetFile = fileName;
    const current = readCurrentFile(targetFile)!;
    const [renamed, changedStart, changedEnd] = applyRewiredRenames(
      current,
      renames,
    );
    changes.set(targetFile, [renamed, changedStart, changedEnd]);
  }
  return changes;
}

function buildNewText(original: string, to: string, renameItem: RenameLocationWithMeta) {
  if (renameItem.isShorthand) {
    return `${original}: ${to}`;
  }
  if (renameItem.isExportedSpecifier) {
    return `${to} as ${original}`;
  }
  return to;
}

export function applyRewiredRenames(
  code: string,
  renames: RenameLocationWithMeta[],
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
    const toName = buildNewText(rename.original, rename.to, rename);
    const start = rename.textSpan.start;
    const end = rename.textSpan.start + rename.textSpan.length;
    debugLog("[name:from]", rename.original, '[name:to]', toName);

    if (changedStart === 0 || changedStart > start) {
      changedStart = start;
    }
    if (changedEnd === 0 || changedEnd < end) {
      changedEnd = end;
    }
    current = current.slice(0, start + offset) + toName +
      current.slice(end + offset);
    offset += toName.length - (end - start);
  }
  return [current, changedStart, changedEnd];
}
