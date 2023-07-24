// import type TS from "typescript";
// export type { TS };
import ts from "typescript";

export type SymbolWalkerResult = {
  types: ReadonlyArray<ts.Type>;
  symbols: ReadonlyArray<ts.Symbol>;
};

export interface SymbolWalker {
  walkType(root: ts.Type): void;
  walkSymbol(root: ts.Symbol): void;
  getVisited(): SymbolWalkerResult;
  clear(): void;
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

/**
 * Node annotation with comments
 * ex. internal or external
 */
export type BindingAnnotation = {
  internal?: boolean;
  external?: boolean;
};

// ---- TypeScript internal types ----
// annotated by external for mangle safe

// An instantiated anonymous type has a target and a mapper
export interface AnonymousType extends ts.ObjectType {
  /** @external */ target?: AnonymousType; // Instantiation target
  // mapper?: ts.TypeMapper;     // Instantiation mapper
  // instantiations?: Mapz<string, ts.Type>; // Instantiations of generic type alias (undefined if non-generic)
}
export interface MappedType extends AnonymousType {
  // /** @external */ declaration: ts.MappedTypeNode;
  /** @external */ typeParameter?: ts.TypeParameter;
  /** @external */ constraintType?: ts.Type;
  // /** @external */ nameType?: ts.Type;
  /** @external */ templateType?: ts.Type;
  /** @external */ modifiersType?: ts.Type;
  // /** @external */ resolvedApparentType?: ts.Type;
  // /** @external */ containsError?: boolean;
}
