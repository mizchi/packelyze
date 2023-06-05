import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";

const srcEffTemplate = `// optools analyze entrypoint
export * from "./index";
`;

export async function init() {
  const cwd = process.cwd();
  const args = parseArgs({
    // 2 is first arg
    args: process.argv.slice(3),
    options: {
      config: {
        type: "string",
        short: "c",
        default: "optools.config.json",
      },
    },
  });

  if (args.values.config != null) {
    const configPath = path.join(cwd, args.values.config);
    if (fs.existsSync(configPath)) {
      console.error("[optools] config file already exists", configPath);
      process.exit(1);
    }
    // check src/index.ts exists
    const indexExists = path.join(cwd, "src/index.ts");
    let existed = false;
    if (fs.existsSync(indexExists)) {
      // write src/_eff.ts
      fs.writeFileSync(path.join(cwd, "src/_eff.ts"), srcEffTemplate);
      existed = true;
    }

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          input: existed ? "lib/_eff.d.ts" : "lib/index.d.ts",
          output: "_optools-analyzed.json",
          builtins: ["es", "dom", "worker", "httpHeaders"],
          external: [],
        },
        null,
        2,
      ),
    );
    console.error("[optools] generate config >", configPath);
    // TODO: use inquiry
    // generate tsconfig.optools.json
    const tsConfigOptoolsPath = path.join(cwd, "tsconfig.optools.json");
    fs.writeFileSync(
      tsConfigOptoolsPath,
      JSON.stringify(
        {
          extends: "./tsconfig.json",
          compilerOptions: {
            rootDir: "src",
            outDir: "lib",
            declaration: true,
            noEmit: false,
            emitDeclarationOnly: true,
          },
        },
        null,
        2,
      ),
    );
    console.error(
      "[optools:init] generate tsconfig.optools.json >",
      tsConfigOptoolsPath,
    );

    // check tsconfig.json exists
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      console.info("[optools:init] warning! tsconfig.json does not exist");
    }

    // print usage example
    console.log(`[optools:init] Ready for optimization!

1. Add "prebuild" scripts to package.json

"scripts": {
  "analyze": "tsc -p tsconfig.optools.json && optools analyze-dts",
  "build": "npm run analyze && <your build command>"
}

2. Ignore _optools-analyzed.json in .gitignore

3. Use with terser

import analyzed from "./_optools-analyzed.json";
// ... in terser config
{
  mangle: {
    properties: {
      builtins: true,
      regex: /.*/,
      reserved: analyzed.reserved
    }
  }
}
`);
  }
}
