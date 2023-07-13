import ts from "typescript";

// subset of rollup plugin but not only for rollup
export interface Minifier {
  process(): void;
  readFile(fileName: string): string | undefined;
  notifyChange(fileName: string, content: string): void;
  getSourceMapForFile(id: string): string | undefined;
  exists(fileName: string): boolean;
  getCompilerOptions(): ts.CompilerOptions;
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
};
