export type Result = {
  fileName: string;
  content: string;
  start: number;
  end: number;
};

function apply(code: string): { content: string; start: number; end: number } {
  return {
    content: code,
    start: 1,
    end: 2,
  };
}

export function getChanges(fileNames: string[]): Result[] {
  return fileNames.map((targetFile) => {
    const result = apply(targetFile);
    return {
      fileName: targetFile,
      ...result,
    };
  });
}
