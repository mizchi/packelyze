import ts from "typescript";

export type BatchRenameLocation = ts.RenameLocation & {
  original: string;
  to: string;
};

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
