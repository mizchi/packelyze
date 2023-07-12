import "./globals";
import path from "node:path";
import { test } from "vitest";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #case16-destructuring", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case16-destructuring"));
});
test("rollup #case17-re-export", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case17-re-export"));
});