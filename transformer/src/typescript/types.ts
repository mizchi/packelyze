// import type TS from "typescript";
// export type { TS };
import ts from "typescript";

export interface TsSymbol extends ts.Node {
  id: number;
}

export type FindRenameLocations = ts.LanguageService["findRenameLocations"];

/**
 * to batch rename, we need to know the original text and the new text.
 */
export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};
