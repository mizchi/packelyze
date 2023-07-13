// Generator function
function* k() {
  let j = 0;
  while (true) {
    yield { x: j };
    j++;
  }
}
function run() {
  for (const q of k()) {
    console.log(q.x);
  }
}
// Async generator function
async function* asyncObjectGenerator() {
  let z = 0;
  while (true) {
    yield { id: z, data: { value: `Value ${z}` } };
    z++;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // delay for demonstration
  }
}

export { asyncObjectGenerator, run };
