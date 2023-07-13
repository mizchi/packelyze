// Fetch with only the URL parameter
async function k(url) {
  return fetch(url);
}
// Fetch with both the URL and options parameters
async function x(url, options) {
  return fetch(url, options);
}
// Fetch with Request object
async function j(request) {
  return fetch(request);
}
// Using the results of a fetch call
async function q(url) {
  const z = await fetch(url);
  if (!z.ok) {
    throw new Error(`HTTP error! status: ${z.status}`);
  }
  return await z.text();
}
// Call these functions with valid parameters
k("https://example.com");
x("https://example.com", { method: "GET" });
j(new Request("https://example.com"));
q("https://example.com");
async function p(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
// Use the function with a valid payload
const f = { key1: "value", key2: 123 };
p("https://example.com", f);