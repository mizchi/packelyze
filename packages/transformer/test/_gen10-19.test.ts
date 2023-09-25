import path from "node:path";
import { test } from "vitest";
import "./globals";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #case10-module", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case10-module"));
});
test("rollup #case11-conditional", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case11-conditional"));
});
test("rollup #case12-fetch", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case12-fetch"));
});
test("rollup #case13-generator", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case13-generator"));
});
test("rollup #case14-promise", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case14-promise"));
});
test("rollup #case15-external-import", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case15-external-import"));
});
test("rollup #case16-destructuring", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case16-destructuring"));
});
test("rollup #case17-re-export", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case17-re-export"));
});
test("rollup #case18-export-type", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case18-export-type"));
});
test("rollup #case19-extend", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/case19-extend"));
});
