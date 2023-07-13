import type { LocExt, Loc } from "./types";

export function extend(fileNames: string[]): LocExt[] {
  const locs: Loc[] = fileNames.map((fileName) => ({
    fileName,
  }));
  return locs.map((loc) => ({
    ...loc,
    original: loc.fileName,
    to: loc.fileName,
  }));
}
