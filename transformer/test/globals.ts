import { expect } from "vitest";
import { formatTs } from "./testUtils";

const stripEmptyLines = (code: string) => {
  return code
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
};

function generateDiff(expectedLines: string[], receivedLines: string[]): string {
  const diffLines: string[] = [];

  // 共通の行を比較し、差分を生成します
  const minLength = Math.min(expectedLines.length, receivedLines.length);
  for (let i = 0; i < minLength; i++) {
    if (expectedLines[i] !== receivedLines[i]) {
      diffLines.push(`- ${expectedLines[i]}`);
      diffLines.push(`+ ${receivedLines[i]}`);
    }
  }

  if (expectedLines.length > minLength) {
    for (let i = minLength; i < expectedLines.length; i++) {
      diffLines.push(`- ${expectedLines[i]}`);
    }
  }

  if (receivedLines.length > minLength) {
    for (let i = minLength; i < receivedLines.length; i++) {
      diffLines.push(`+ ${receivedLines[i]}`);
    }
  }

  return diffLines.join("\n");
}

expect.extend({
  toEqualFormatted(received: string, expected: string) {
    const receivedFormatted = stripEmptyLines(formatTs(received));
    const expectedFormatted = stripEmptyLines(formatTs(expected));

    const receivedFormattedLines = receivedFormatted.split("\n");
    const expectedFormattedLines = expectedFormatted.split("\n");

    const diffText = generateDiff(expectedFormattedLines, receivedFormattedLines);
    return {
      pass: receivedFormatted === expectedFormatted,
      message: () => {
        return "---[received]---\n" + receivedFormatted + "\n---[diff]---:\n" + diffText + "\n";
      },
    };
  },
  toEqualSet(received, expected) {
    const { isNot } = this;
    const receivedSet = new Set(received);
    const expectedSet = new Set(expected);
    const pass = received.size === expected.size && [...receivedSet].every((item) => expectedSet.has(item));

    return {
      pass,
      message: () => {
        const plus = [...expectedSet].filter((item) => !receivedSet.has(item)).map((x) => `"${x}"`);
        const minus = [...receivedSet].filter((item) => !expectedSet.has(item)).map((x) => `"${x}"`);
        let text = `Set differences:`;
        if (plus.length > 0) {
          text += `\n${plus.map((t) => `\n+ ${t}`).join("")}`;
        }
        if (minus.length > 0) {
          text += `\n${minus.map((t) => `\n- ${t}`).join("")}`;
        }
        return text;
      },
    };
  },
});
