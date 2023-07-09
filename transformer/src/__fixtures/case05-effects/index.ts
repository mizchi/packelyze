// keep body for side effects
type MyBody = {
  body: number;
};

export function run() {
  const body: MyBody = { body: 1 };
  fetch("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
