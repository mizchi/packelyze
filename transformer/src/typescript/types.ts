// import type TS from "typescript";
// export type { TS };
import ts from "typescript";

// ---- TypeScript internal types ----

// An instantiated anonymous type has a target and a mapper
export interface AnonymousType extends ts.ObjectType {
  target?: AnonymousType; // Instantiation target
  // mapper?: ts.TypeMapper;     // Instantiation mapper
  // instantiations?: Mapz<string, ts.Type>; // Instantiations of generic type alias (undefined if non-generic)
}
export interface MappedType extends AnonymousType {
  declaration: ts.MappedTypeNode;
  typeParameter?: ts.TypeParameter;
  constraintType?: ts.Type;
  nameType?: ts.Type;
  templateType?: ts.Type;
  modifiersType?: ts.Type;
  resolvedApparentType?: ts.Type;
  containsError?: boolean;
}

export interface TypeWithId extends ts.Type {
  // original hidden member
  id: number;
}
export interface SymbolWithId extends ts.Symbol {
  // original hidden member
  id: number;
}

// local types

export type FindRenameLocations = ts.LanguageService["findRenameLocations"];

/**
 * to batch rename, we need to know the original text and the new text.
 */
export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};
