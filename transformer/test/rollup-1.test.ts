import "./globals";
import path from "node:path";
import { test } from "vitest";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #case08-typeargs", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case08-typeargs"));
});
test("rollup #case09-complex", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case09-complex"));
});
test("rollup #case10-module", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case10-module"));
});
test("rollup #case11-conditional", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case11-conditional"));
});
test("rollup #case12-fetch", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case12-fetch"));
});
test("rollup #case13-generator", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case13-generator"));
});
test("rollup #case14-promise", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case14-promise"));
});
test("rollup #case15-external-import", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case15-external-import"));
});