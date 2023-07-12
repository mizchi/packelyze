import ts from "typescript";

/**
 * to update partial nodes, keep start and end
 */
export type FileChangeResult = {
  fileName: string;
  content: string;
  start?: number;
  end?: number;
  map?: string;
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
  // | ts.FunctionDeclaration
  // | ts.PropertyAssignment
  | ts.MethodDeclaration
  | ts.ClassDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;
