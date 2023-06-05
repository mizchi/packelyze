import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
// import inquirer from "inquirer";
import { input } from "@inquirer/prompts";
import { confirm } from "@inquirer/prompts";

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
      const isContinue = await confirm({
        message: "optools.config.json already exists. Continue with override?",
        default: false,
      });
      if (!isContinue) {
        process.exit(1);
      }
    }
    // check src/index.ts exists
    const indexTsExists = path.join(cwd, "src/index.ts");
    const indexTsxExists = path.join(cwd, "src/index.tsx");

    let srcEffCreated = false;
    if (fs.existsSync(indexTsExists) || fs.existsSync(indexTsxExists)) {
      // write src/_eff.ts
      const result = await confirm({
        message: "Create src/_eff.ts for analyzer target?",
        default: true,
      });
      if (result) {
        fs.writeFileSync(path.join(cwd, "src/_eff.ts"), srcEffTemplate);
        srcEffCreated = true;
      }
    }

    const inputTarget = await input({
      message: "Input analyzer entrypoint",
      default: srcEffCreated ? "lib/_eff.d.ts" : "lib/index.d.ts",
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          input: inputTarget,
          output: "_optools-analyzed.json",
          builtins: ["es", "dom", "worker", "httpHeaders"],
          external: [],
        },
        null,
        2,
      ),
    );
    console.info("[optools] generate config >", configPath);
    // TODO: use inquiry
    // generate tsconfig.optools.json

    const isCreateTsconfig = await confirm({
      message: "Create tsconfig.optools.json?",
      default: true,
    });
    if (isCreateTsconfig) {
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
      console.info(
        "[optools:init] generate tsconfig.optools.json >",
        tsConfigOptoolsPath,
      );
    } else {
      console.info(
        "[optools:init] skip. Ensure to emit lib/*.d.ts by yourself",
      );
    }

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
