import { ScriptTarget, createSourceFile } from "typescript";

console.log(createSourceFile("input.ts", `export const x = 1;`, ScriptTarget.Latest, true));
