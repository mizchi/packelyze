import type { BatchRenameLocation, BindingAnnotation } from "../ts/types";
import ts from "typescript";

export type ProjectExported = {
  symbols: ReadonlyArray<ts.Symbol>;
  types: ReadonlyArray<ts.Type>;
  nodes: ReadonlyArray<ts.NamedDeclaration>;
  // locals: ReadonlyArray<BindingNode>;
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
  // | ts.FunctionDeclaration
  // | ts.PropertyAssignment
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

// export type CodeAction = {
//   to: string;
//   node: ts.Node;
// };

/**
 * to batch rename, we need to know the original text and the new text.
 */
export type BatchRenameLocationWithSource = BatchRenameLocation & {
  node: ts.Node;
};

export type BindingNode = ts.Identifier | ts.PrivateIdentifier;
