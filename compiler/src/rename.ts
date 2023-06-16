import { Identifier, LanguageService, Program, RenameLocation, SourceFile, SyntaxKind, TransformerFactory, UserPreferences, ExportDeclaration, 
  Visitor, isExportDeclaration, factory, forEachChild, visitEachChild, Node, isVariableStatement, isIdentifier, isSourceFile, isNamedExports, visitNode, isExportSpecifier
} from "typescript";
import { AnyExportableDeclaration, getNodeAtPosition, isExportableDeclaration } from "./nodeUtils";

export type RenameLocationWithMeta = RenameLocation & {
  isShorthand?: boolean;
  isExportedSpecifier?: boolean;
};

export type BatchRenameItem = {
  original: string;
  to: string;
  locations: readonly RenameLocationWithMeta[];
};

export type RewiredRenameItem = {
  original: string;
  to: string;
  location: RenameLocationWithMeta;
};

/** wrap service.findRenameLocations */
export function findRenameDetails(
  service: LanguageService,
  file: SourceFile,
  pos: number,
  prefs: UserPreferences = {},
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
    if (isExportSpecifier(targetNode.parent) && targetNode.parent.propertyName == null) {
      rename.isExportedSpecifier = true;
    }
  }
  return renames;
}

export function getRenameAppliedState(
  renames: BatchRenameItem[],
  readCurrentFile: (fname: string) => string | undefined,
  normalizePath: (fname: string) => string,
): Map<string, [changed: string, start: number, end: number]> {
  // rewire renames by each files
  const targetFiles = new Set(
    renames.map((r) => r.locations!.map((loc) => normalizePath(loc.fileName)))
      .flat(),
  );
  const rewiredRenames: Map<string, RewiredRenameItem[]> = new Map();
  for (const targetFile of targetFiles) {
    const sortedRenames: RewiredRenameItem[] = renames.map((r) => {
      const renamesToFile = r.locations.filter((loc) =>
        normalizePath(loc.fileName) === targetFile
      );
      return renamesToFile.map((loc) => ({
        original: r.original,
        to: r.to,
        location: loc,
      }));
    })
      .flat()
      .sort((a, b) => a.location.textSpan.start - b.location.textSpan.start);
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
  renames: RewiredRenameItem[],
): [renamed: string, changedStart: number, changedEnd: number] {
  let current = code;
  let offset = 0;
  let changedStart = 0;
  let changedEnd = 0;
  for (const rename of renames) {
    const loc = rename.location;
    const toName = buildNewText(rename.original, rename.to, rename.location);
    const start = loc.textSpan.start;
    const end = loc.textSpan.start + loc.textSpan.length;
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
