import ts from "typescript";

// subset of rollup plugin but not only for rollup
export interface Minifier {
  process(): void;
  readFile(fileName: string): string | undefined;
  notifyChange(fileName: string, content: string): void;
  getSourceMapForFile(id: string): string | undefined;
}

export type TsMinifyOptions = {
  // current dir
  cwd?: string;
  // searching extension for rollup resolveId
  extensions?: string[];
  // explicit rootFileNames (required by vite)
  rootFileNames?: string[];
  // override compiler options
  compilerOptions?: Partial<ts.CompilerOptions>;
  // override transpile compiler options
  transpileOptions?: Partial<ts.CompilerOptions>;
  // transform only include
  include?: string[];
  // load transformed code only to use with other plugins (e.g. rollup-plugin-ts)
  preTransformOnly?: boolean;
  withOriginalComment?: boolean;
  mangleValidator?: MangleValidator;
  onwarn?: OnWarning;
};

export enum WarningCode {
  MANGLE_STOP_BY_LOCATION_CONFLICT = 1,
  MANGLE_STOP_BY_EXTERNAL,
}

export type Warning = {
  code: WarningCode;
  message: string;
};

export type OnWarning = (warning: Warning) => void;

export type MangleValidator = (biding: BindingNode) => boolean | void;

export type ProjectExported = {
  symbols: ReadonlyArray<ts.Symbol>;
  types: ReadonlyArray<ts.Type>;
  nodes: ReadonlyArray<ts.NamedDeclaration>;
  internal: ReadonlyArray<BindingNode>;
  external: ReadonlyArray<BindingNode>;
};

export type ChangeResult = {
  content: string;
  start?: number;
  end?: number;
  map?: string;
};

/**
 * to update partial nodes, keep start and end
 */
export interface FileChangeResult extends ChangeResult {
  fileName: string;
}

export type MangleTargetNode =
  | ts.TypeLiteralNode
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.TypeAliasDeclaration
  | ts.InterfaceDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.ClassExpression
  | ts.MethodDeclaration
  | ts.ClassDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.EnumDeclaration;
// | ts.EnumMember;

export type SymbolBuilder = {
  create: (validate?: (char: string) => boolean) => string;
  reset: (next?: number) => void;
};

export type BatchRenameLocationWithSource = BatchRenameLocation & {
  node: ts.Node;
};

export type BindingNode = ts.Identifier | ts.PrivateIdentifier;

// import type TS from "typescript";
// export type { TS };

export type SymbolWalkerResult = {
  types: ReadonlyArray<ts.Type>;
  symbols: ReadonlyArray<ts.Symbol>;
  nodes: ReadonlyArray<ts.Node>;
};

export interface SymbolWalker {
  walkType(root: ts.Type): void;
  walkSymbol(root: ts.Symbol): void;
  walkModuleSymbol(root: ts.Symbol): void;
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
