import fs from "node:fs";
import path from "node:path";
import { beforeAll, expect, test } from "vitest";
import { bundle, execBuild } from "../_testUtils";

const cwd = path.dirname(new URL(import.meta.url).pathname);

let analyzed: any;
beforeAll(async () => {
  await execBuild(cwd);
  analyzed = JSON.parse(fs.readFileSync(path.join(cwd, "analyzed.json"), "utf-8"));
});

test("compile with analyze", async () => {
  const fileName = path.join(cwd, "input.ts");
  const out = await bundle(fileName, {
    mangle: {
      properties: {
        regex: /.*/,
        reserved: analyzed.reserved,
      },
    },
  });
  expect(analyzed.reserved).toEqual(["0", "1", "100", "A", "B", "C", "a", "b", "bar", "f", "g"]);
  expect(out).includes("bar");
  expect(out).includes(".filter");
  expect(out).includes("console.log");
  expect(out).not.includes("xxxxx");
  expect(out).not.includes("internal");
  expect(out).not.includes("pf", "z");
  expect(out).toMatchSnapshot();
});

test("break without terser builtins", async () => {
  const fileName = path.join(cwd, "input.ts");
  const out = await bundle(fileName, {
    mangle: {
      properties: {
        builtins: true,
        regex: /.*/,
        reserved: analyzed.reserved,
      },
    },
  });
  expect(out).not.includes(".filter");
});
