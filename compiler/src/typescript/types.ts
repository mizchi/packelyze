// import type TS from "typescript";
// export type { TS };
import ts from "typescript";

export interface TSSymbol extends ts.Node {
  id: number;
}

export type FindRenameLocations = ts.LanguageService["findRenameLocations"];
