import ts from "typescript";
import { TraverseableNode, getNodeAtPosition } from "../nodeUtils";
// import { collectGlobalVariables } from "../__deprecated/analyzer";

export enum RenameSourceKind {
  ScopedIdentifier = 1,
  ScopedSignature,
  IntermediateExportedSpecifier,
  IntermediateImportSpecifier,
}

export enum RenameTargetKind {
  Local = 1,
  Shorthand,
  ExportedSpecifier,
  ImportSpecifier,
}

export type RenameItem = ts.RenameLocation & {
  sourceKind: RenameSourceKind;
  targetKind: RenameTargetKind;
  source: string;
  target: string;
};

export type ScopedSymbol = {
  symbol: ts.Symbol;
  parentBlock: TraverseableNode;
  isExportRelated?: boolean;
};

/** wrap service.findRenameLocations */
export function collectRenameItems(
  service: ts.LanguageService,
  file: ts.SourceFile,
  pos: number,
  sourceKind: RenameSourceKind,
  source: string,
  to: string,
  prefs: ts.UserPreferences = {
    providePrefixAndSuffixTextForRename: true,
  },
): RenameItem[] | undefined {
  const renames = service.findRenameLocations(file.fileName, pos, false, false, prefs) as RenameItem[] | undefined;
  if (renames == null) {
    return;
  }

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  // check is export related
  for (const rename of renames) {
    rename.sourceKind = sourceKind;
    rename.source = source;
    rename.target = to;

    const targetNode = getNodeAtPosition(file, rename.textSpan.start);
    if (checker.getShorthandAssignmentValueSymbol(targetNode.parent) != null) {
      // check shorthand
      rename.targetKind = RenameTargetKind.Shorthand;
      rename.target = buildNewText(rename.source, rename.target, rename);
    } else if (ts.isExportSpecifier(targetNode.parent) && targetNode.parent.propertyName == null) {
      // check export specifier
      rename.targetKind = RenameTargetKind.ExportedSpecifier;
      rename.target = buildNewText(rename.source, rename.target, rename);
    } else {
      // default is local
      rename.targetKind = RenameTargetKind.Local;
      rename.target = to;
    }
  }
  return renames;
}

export function getRenameAppliedState(
  renames: RenameItem[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): Map<string, [changed: string, start: number, end: number]> {
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
  const changes = new Map<string, [changed: string, start: number, end: number]>();
  for (const [fileName, renames] of rewiredRenames.entries()) {
    const targetFile = fileName;
    const current = readCurrentFile(targetFile)!;
    const [renamed, changedStart, changedEnd] = applyRewiredRenames(current, renames);
    changes.set(targetFile, [renamed, changedStart, changedEnd]);
  }
  return changes;
}

function buildNewText(original: string, to: string, renameItem: RenameItem) {
  if (renameItem.targetKind === RenameTargetKind.Shorthand) {
    return `${original}: ${to}`;
  }
  if (renameItem.targetKind === RenameTargetKind.ExportedSpecifier) {
    return `${to} as ${original}`;
  }
  return to;
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
    const toName = rename.target;
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
