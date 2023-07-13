function k(code) {
  return {
    content: code,
    start: 1,
    end: 2,
  };
}
function getChanges(fileNames) {
  return fileNames.map((targetFile) => {
    const x = k(targetFile);
    return {
      fileName: targetFile,
      ...x,
    };
  });
}

export { getChanges };
