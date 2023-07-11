// Fetch with only the URL parameter
async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}

// Fetch with both the URL and options parameters
async function fetchDataWithOptions(url: string, options: RequestInit): Promise<Response> {
  return fetch(url, options);
}

// Fetch with Request object
async function fetchDataWithRequest(request: Request): Promise<Response> {
  return fetch(request);
}

// Using the results of a fetch call
async function useFetchResults(url: string): Promise<string> {
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

type Payload = {
  key1: string;
  key2: number;
};
async function postWithPayload(url: string, payload: Payload): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// Use the function with a valid payload
const payload: Payload = { key1: "value", key2: 123 };
postWithPayload("https://example.com", payload);
export {};
