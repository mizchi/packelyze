function run() {
  const k = { body: 1 };
  fetch("https://example.test", {
    method: "POST",
    body: JSON.stringify(k),
  });
}

export { run };
