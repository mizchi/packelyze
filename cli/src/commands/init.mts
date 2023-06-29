import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import { checkbox, confirm, input } from "@inquirer/prompts";

const srcEffTemplate = `// packelyze analyze entrypoint
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
        default: "packelyze.config.json",
      },
    },
  });

  if (args.values.config != null) {
    const configPath = path.join(cwd, args.values.config);
    if (fs.existsSync(configPath)) {
      const isContinue = await confirm({
        message: "packelyze.config.json already exists. Continue with override?",
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

    const checked = await checkbox({
      message: "Select reserved buitins. (If you use terser builtins, you don't need to select)",
      choices: [
        { name: "es", value: "es", checked: true },
        { name: "dom", value: "dom", checked: true },
        { name: "worker", value: "worker" },
        { name: "css", value: "css" },
        { name: "node", value: "node" },
        { name: "react", value: "react" },
        { name: "httpHeaders", value: "httpHeaders" },
        { name: "terser's domprops", value: "domprops" },
        { name: "cloudflareWorkers", value: "cloudflareWorkers" },
      ],
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          input: inputTarget,
          output: "_packelyze-analyzed.json",
          builtins: checked,
          external: [],
        },
        null,
        2,
      ),
    );
    console.info("[packelyze] generate config >", configPath);
    const isCreateTsconfig = await confirm({
      message: "Create tsconfig.packelyze.json?",
      default: true,
    });
    if (isCreateTsconfig) {
      const tsConfigpackelyzePath = path.join(cwd, "tsconfig.packelyze.json");
      fs.writeFileSync(
        tsConfigpackelyzePath,
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
      console.info("[packelyze:init] generate tsconfig.packelyze.json >", tsConfigpackelyzePath);
    } else {
      console.info("[packelyze:init] skip. Ensure to emit lib/*.d.ts by yourself");
    }

    // check tsconfig.json exists
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      console.info("[packelyze:init] warning! tsconfig.json does not exist");
    }

    // print usage example
    console.log(`[packelyze:init] Ready for optimization!

1. Add "prebuild" scripts to package.json

"scripts": {
  "analyze": "tsc -p tsconfig.packelyze.json && packelyze analyze-dts",
  "build": "npm run analyze && <your build command>"
}

2. Ignore _packelyze-analyzed.json in .gitignore

3. Use with terser

import analyzed from "./_packelyze-analyzed.json";
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
