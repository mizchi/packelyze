import ts from "typescript";

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

export type SymbolBuilder = {
  create: (validate?: (char: string) => boolean) => string;
  reset: (next?: number) => void;
};
