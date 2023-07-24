function extend(fileNames) {
  const locs = fileNames.map((fileName) => ({
    fileName,
  }));
  return locs.map((loc) => ({
    ...loc,
    original: loc.fileName,
    to: loc.fileName,
  }));
}

export { extend };
