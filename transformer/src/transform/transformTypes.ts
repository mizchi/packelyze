import type { BatchRenameLocation, BindingAnnotation } from "../ts/types";
import ts from "typescript";

export type ProjectExported = {
  symbols: ReadonlyArray<ts.Symbol>;
  types: ReadonlyArray<ts.Type>;
  nodes: ReadonlyArray<MangleTargetNode>;
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

export type CodeAction = {
  actionType: "replace" | "remove" | "add";
  parentKind: ts.SyntaxKind;
  fileName: string;
  original: string;
  to: string;
  start: number;
  annotation: BindingAnnotation | undefined;
  originalTrial: MangleTrial;
};

/**
 * to batch rename, we need to know the original text and the new text.
 */
export type BatchRenameLocationWithSource = BatchRenameLocation & {
  by: CodeAction;
};

export type BindingNode = ts.Identifier | ts.PrivateIdentifier;

export enum MangleReason {
  Local = "Local",
  Inferred = "Inferred",
  Internal = "Internal",
}

export enum MangleStopReason {
  TypeOnly = "TypeOnly",
  External = "External",
  Exported = "Exported",
  UnsupportedInference = "UnsupportedInference",
}

export type MangleTrial =
  | {
      mangle: true;
      node: ts.Node;
      reason: MangleReason;
    }
  | {
      mangle: false;
      node: ts.Node;
      reason: MangleStopReason;
    }
  | {
      mangle: false;
      node: ts.Node;
      relatedSymbol?: ts.Symbol;
      relatedNode?: ts.Node;
      reason: MangleStopReason.Exported;
    };
