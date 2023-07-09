import ts from "typescript";

/**
 * to batch rename, we need to know the original text and the new text.
 */
export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};
/**
 * to update partial nodes, keep start and end
 */
export type FileChangeResult = {
  fileName: string;
  content: string;
  start?: number;
  end?: number;
};

export type MangleAction = {
  fileName: string;
  original: string;
  to: string;
  start: number;
  // TODO: now assigment is ignored
  isAssignment: boolean;
};

export type MangleTargetNode =
  | ts.TypeLiteralNode
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.TypeAliasDeclaration
  | ts.InterfaceDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.MethodDeclaration
  | ts.ClassDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;