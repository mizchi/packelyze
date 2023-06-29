import path from "node:path";
import fs from "node:fs";
import { bundle, execBuild } from "../_testUtils";
import { beforeAll, expect, test } from "vitest";

const cwd = path.dirname(new URL(import.meta.url).pathname);

let analyzed: any;
beforeAll(async () => {
  await execBuild(cwd, { builtins: ["es", "node"] });
  analyzed = JSON.parse(fs.readFileSync(path.join(cwd, "analyzed.json"), "utf-8"));
});

test("compile with analyze", async () => {
  const fileName = path.join(cwd, "input.ts");
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
    ["node:util"],
  );
  expect(out).includes("node:util");
  expect(out).includes("process.argv");
  expect(out).includes("process.env.NODE_ENV");
  expect(out).includes("options");
  expect(out).includes("type");
  expect(out).includes("short");

  // expect(out).includes("justifyContent");
  // expect(out).includes("alignItems");
  // expect(out).includes("children");
  // expect(out).not.includes("internal");
  expect(out).toMatchSnapshot();
});
