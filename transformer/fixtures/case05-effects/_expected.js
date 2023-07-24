function run() {
  const body = { body: 1 };
  fetch("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { run };
