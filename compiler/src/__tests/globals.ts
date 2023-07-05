import { expect } from "vitest";
import prettier from "prettier";

function format(code: string) {
  return prettier.format(code, {
    filepath: "$.tsx",
    parser: "typescript",
    semi: true,
  });
}

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

  // expectedLinesに追加の行がある場合、差分として生成します
  if (expectedLines.length > minLength) {
    for (let i = minLength; i < expectedLines.length; i++) {
      diffLines.push(`- ${expectedLines[i]}`);
    }
  }

  // receivedLinesに追加の行がある場合、差分として生成します
  if (receivedLines.length > minLength) {
    for (let i = minLength; i < receivedLines.length; i++) {
      diffLines.push(`+ ${receivedLines[i]}`);
    }
  }

  return diffLines.join("\n");
}

expect.extend({
  toEqualFormatted(received: string, expected: string) {
    const receivedFormatted = stripEmptyLines(format(received));
    const expectedFormatted = stripEmptyLines(format(expected));

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
      // do not alter your "pass" based on isNot. Vitest does it for you
      pass,
      message: () => {
        // if (isNot) {
        const plus = [...expectedSet].filter((item) => !receivedSet.has(item)).map((x) => `"${x}"`);
        const minus = [...receivedSet].filter((item) => !expectedSet.has(item)).map((x) => `"${x}"`);
        let text = `Set Diff:`;
        if (plus.length > 0) {
          text += ` + ${plus.join(", ")}`;
        }
        if (minus.length > 0) {
          text += ` - ${minus.join(", ")}`;
        }
        return text;
        // }
        // return `${[...received].map((t) => t)} is ${[...expected].map((t) => t)}`;
      },
    };
  },
});
