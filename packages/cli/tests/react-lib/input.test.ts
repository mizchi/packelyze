import path from "node:path";
import fs from "node:fs";
import { bundle, execBuild } from "../_testUtils";
import { beforeAll, expect, test } from "vitest";

const cwd = path.dirname(new URL(import.meta.url).pathname);

let analyzed: any;
beforeAll(async () => {
  await execBuild(cwd, { builtins: ["es", "react"] });
  analyzed = JSON.parse(fs.readFileSync(path.join(cwd, "analyzed.json"), "utf-8"));
});

test("compile with analyze", async () => {
  const fileName = path.join(cwd, "input.tsx");
  const out = await bundle(
    fileName,
    {
      mangle: {
        properties: {
          builtins: true,
          regex: /.*/,
          reserved: analyzed.reserved,
        },
      },
    },
    ["react", "react/jsx-runtime", "react/jsx-dev-runtime"],
  );
  expect(out).includes("display");
  expect(out).includes("justifyContent");
  expect(out).includes("alignItems");
  expect(out).includes("children");
  expect(out).not.includes("internal");
  expect(out).toMatchSnapshot();
});
