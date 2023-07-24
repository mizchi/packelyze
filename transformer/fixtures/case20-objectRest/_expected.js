function apply(code) {
  return {
    content: code,
    start: 1,
    end: 2,
  };
}
function getChanges(fileNames) {
  return fileNames.map((targetFile) => {
    const result = apply(targetFile);
    return {
      fileName: targetFile,
      ...result,
    };
  });
}

export { getChanges };
