function extend(fileNames) {
  const k = fileNames.map((fileName) => ({
    fileName,
  }));
  return k.map((loc) => ({
    ...loc,
    original: loc.fileName,
    to: loc.fileName,
  }));
}

export { extend };
