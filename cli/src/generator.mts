import ts from "typescript";
import { type OutputChunk, rollup } from "rollup";
import dts from "rollup-plugin-dts";

export function emitLibDts(
  files: string[],
  outDir: string,
  options: ts.CompilerOptions,
) {
  const shouldOverrideConfigs: Partial<ts.CompilerOptions> = {
    outDir,
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: true,
  };
  const host = ts.createCompilerHost({
    ...options,
    ...shouldOverrideConfigs,
  });
  const program = ts.createProgram(files, options, host);
  const emitResult = program.emit();
  return emitResult;
}

export async function generateBundleDts(
  { input, external, compilerOptions, respectExternal = false }: {
    input: string;
    respectExternal?: boolean;
    external?: string[];
    compilerOptions?: ts.CompilerOptions;
  },
) {
  const bundle = await rollup({
    input: input,
    external,
    plugins: [dts({
      respectExternal,
      compilerOptions: compilerOptions as any,
    })],
  });
  const out = await bundle.generate({
    format: "es",
  });
  const dtsCode = out.output.find((o) => {
    if (o.type === "chunk" && o.fileName.endsWith(".d.ts")) {
      return true;
    }
  }) as OutputChunk;
  return dtsCode.code;
}
