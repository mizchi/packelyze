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

export async function bundleDts(
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

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  const fs = await import("fs/promises");
  const path = await import("node:path");
  const __dirname = path.dirname(new URL(import.meta.url).pathname);

  test("bundleDts: simple", async () => {
    const dtsPath = path.join(__dirname, "__fixtures/simple.d.ts");
    const dtsCode = await bundleDts({
      input: dtsPath,
      external: [],
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
      },
    });
    expect(dtsCode).toMatchSnapshot();
  });

  test("bundleDts: with-delay - respectExternal: true", async () => {
    const simpleDtsPath = path.join(__dirname, "__fixtures/with-delay.d.ts");
    const dtsCode = await bundleDts({
      input: simpleDtsPath,
      external: [],
      respectExternal: true,
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
      },
    });
    expect(dtsCode).includes("declare function delay<T>");
    expect(dtsCode).toMatchSnapshot();
  });

  test("bundleDts: with-delay - respectExternal: false", async () => {
    const dtsPath = path.join(__dirname, "__fixtures/with-delay.d.ts");
    const dtsCode = await bundleDts({
      input: dtsPath,
      external: [],
      respectExternal: false,
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
      },
    });
    expect(dtsCode).not.includes("declare function delay<T>");
    expect(dtsCode).toMatchSnapshot();
  });

  test.skip("bundleDts: with-node-process - respectExternal: true", async () => {
    const dtsPath = path.join(
      __dirname,
      "__fixtures/with-node-process.d.ts",
    );
    const dtsCode = await bundleDts({
      input: dtsPath,
      external: [],
      respectExternal: true,
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
      },
    });
    // expect(dtsCode).not.includes("declare function delay<T>");
    // expect(dtsCode).toMatchSnapshot();
  });
}
