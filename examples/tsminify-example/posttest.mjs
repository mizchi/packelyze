import { test } from 'node:test';
import { ok } from 'node:assert';
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

test('posttest', () => {
  const __dirname = new URL('.', import.meta.url).pathname;
  const index = readdirSync(join(__dirname, 'dist/assets')).find((file) => file.startsWith('index') && file.endsWith('.js'));
  const target = readFileSync(join(__dirname, 'dist/assets', index), 'utf8');
  ok(!target.includes('l1'));
  ok(!target.includes('l2'));
  ok(target.includes('shouldKeep:'));
});