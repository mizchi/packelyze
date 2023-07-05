// sort alphabet by usage rate https://tex2e.github.io/blog/crypto/letter-frequency
// const FIRST_CHARS = [..."_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"] as const;
const FIRST_CHARS = [..."kxjqzpfywgbvdlucmtaonirshe_$KXJQZPFYWGBVDLUCMTAONIRSHE"] as const;

const CHARS = [...FIRST_CHARS, ..."0123456789"] as const;

/**
 * create symbol builder that generates unique symbol for rename
 */
export function createSymbolBuilder() {
  let state = 0;
  const skipped = new Set<number>();

  const reset = (next = 0) => {
    skipped.clear();
    state = next;
  };

  const MAX_TRY_COUNT = 100000;
  const create = (validate?: (char: string) => boolean) => {
    // 1文字目は firstChars から選び、2文字目以降は chars から選ぶ
    // もし validate に失敗したら、state を skpped に入れて、state をインクリメントして再度試行する
    // もし skipped に入っている state があって、その validate が成功したら、それに対応する文字を返し、skipped から削除する
    if (skipped.size > 0) {
      for (const skippedState of skipped) {
        const symbol = numToSymbol(skippedState);
        if (validate?.(symbol) ?? true) {
          skipped.delete(skippedState);
          return symbol;
        }
      }
    }

    let tryCount = 0;
    while (tryCount++ < MAX_TRY_COUNT) {
      const candidate = numToSymbol(state);
      if (validate?.(candidate) ?? true) {
        state++;
        return candidate;
      } else {
        skipped.add(state);
        state++;
      }
    }
    throw new Error(`createSymbolBuilder: MAX_LEN reached`);
  };

  return {
    create,
    reset,
  };
}

/**
 * Generate identifier symbol from number
 * @internal
 */
function numToSymbol(n: number) {
  if (n < 0) {
    throw new Error("invalid source");
  }

  const base = CHARS.length;
  const firstBase = FIRST_CHARS.length;

  let remaining = n;
  let result = "";

  if (remaining < firstBase) {
    return FIRST_CHARS[remaining];
  }

  while (remaining >= firstBase) {
    const index = (remaining - firstBase) % base;
    result = CHARS[index] + result;
    remaining = Math.floor((remaining - firstBase) / base);
  }

  return FIRST_CHARS[remaining] + result;
}
