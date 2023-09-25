import path from "node:path";
import { test } from "vitest";
import "./globals";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #case20-objectRest", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case20-objectRest"));
});
test("rollup #case21-map-infer", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case21-map-infer"));
});
test("rollup #case22-export-types", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case22-export-types"));
});
test("rollup #case23-higher-chain", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case23-higher-chain"));
});
test("rollup #case24-annotations", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case24-annotations"));
});
test("rollup #case25-sublocal", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case25-sublocal"));
});
