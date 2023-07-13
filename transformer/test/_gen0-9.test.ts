import "./globals";
import path from "node:path";
import { test } from "vitest";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #case00-simple", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case00-simple"));
});
test("rollup #case01-basic", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case01-basic"));
});
test("rollup #case02-class", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case02-class"));
});
test("rollup #case03-global", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case03-global"));
});
test("rollup #case04-internal", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case04-internal"));
});
test("rollup #case05-effects", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case05-effects"));
});
test("rollup #case06-types", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case06-types"));
});
test("rollup #case07-react", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case07-react"));
});
test("rollup #case08-typeargs", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case08-typeargs"));
});
test("rollup #case09-complex", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/case09-complex"));
});