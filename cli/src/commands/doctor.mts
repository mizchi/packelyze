import path from "node:path";
import fs from "node:fs";
import process from "node:process";

export async function doctor() {
  const cwd = process.cwd();
  // check gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes("_packelyze-analyzed.json")) {
      console.error(
        "[packelyze:doctor] .gitignore does not include _packelyze-analyzed.json",
      );
      process.exit(1);
    }
  }
  // check src/index.ts or exists
  const srcIndexTsPath = path.join(cwd, "src/index.ts");
  const srcIndexTsxPath = path.join(cwd, "src/index.tsx");

  if (!fs.existsSync(srcIndexTsPath) && !fs.existsSync(srcIndexTsxPath)) {
    console.error("[packelyze:doctor] src/index.ts(x) does not exist");
  }

  // check tsconfig.json
  // exists tsconfig.json or tsconfig.packelyze.json or packelyze.types.json
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  const tsconfigpackelyzePath = path.join(cwd, "tsconfig.packelyze.json");
  let existsAny = false;
  for (
    const configPath of [
      tsconfigpackelyzePath,
      tsconfigPath,
    ]
  ) {
    if (fs.existsSync(configPath)) {
      // TODO: check with typescript config extends
      existsAny = true;
      const tsconfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const basename = path.basename(configPath);
      // check rootDir: src
      if (tsconfig.compilerOptions?.outDir !== "lib") {
        console.error(
          `[packelyze:doctor] ${basename} does not include "rootDir": "lib"`,
        );
      }

      // check declaration: true
      if (tsconfig.compilerOptions?.declaration !== true) {
        console.error(
          `[packelyze:doctor] ${basename} does not include "declaration": true`,
        );
      }
      break;
    }
  }
  if (!existsAny) {
    console.error(
      "[packelyze:doctor] tsconfig.packelyze.json / tsconfig.json does not exist",
    );
    process.exit(1);
  }
  process.exit(0);
}
