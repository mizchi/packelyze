// Fetch with only the URL parameter
async function fetchData(url) {
  return fetch(url);
}
// Fetch with both the URL and options parameters
async function fetchDataWithOptions(url, options) {
  return fetch(url, options);
}
// Fetch with Request object
async function fetchDataWithRequest(request) {
  return fetch(request);
}
// Using the results of a fetch call
async function useFetchResults(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.text();
}
// Call these functions with valid parameters
fetchData("https://example.com");
fetchDataWithOptions("https://example.com", { method: "GET" });
fetchDataWithRequest(new Request("https://example.com"));
useFetchResults("https://example.com");
async function postWithPayload(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
// Use the function with a valid payload
const payload = { key1: "value", key2: 123 };
postWithPayload("https://example.com", payload);
