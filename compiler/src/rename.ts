import { RenameLocation } from "typescript";

export type RenameInfo = {
  original: string;
  to: string;
  locations: readonly RenameLocation[];
};

export type RewiredRenameItem = {
  original: string;
  to: string;
  location: RenameLocation;
};

export function getRenameAppliedState(
  renames: RenameInfo[],
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

function applyRewiredRenames(
  code: string,
  renames: RewiredRenameItem[],
): [renamed: string, changedStart: number, changedEnd: number] {
  let current = code;
  let offset = 0;
  let changedStart = 0;
  let changedEnd = 0;
  // for (const rename of renames) {
  //   const loc = rename.location;
  //   const toName = rename.to;
  //   const start = loc.textSpan.start;
  //   const end = loc.textSpan.start + loc.textSpan.length;
  //   current = current.slice(0, start + offset) + toName +
  //     current.slice(end + offset);
  //   offset += toName.length - (end - start);
  // }
  for (const rename of renames) {
    const loc = rename.location;
    const toName = rename.to;
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
