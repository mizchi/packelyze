// Generator function
function* objectGenerator() {
  let i = 0;
  while (true) {
    yield { /*foo*/ k: i };
    i++;
  }
}
function run() {
  for (const obj of objectGenerator()) {
    console.log(obj./*foo*/ k);
  }
}
// Async generator function
async function* asyncObjectGenerator() {
  let i = 0;
  while (true) {
    yield { id: i, data: { value: `Value ${i}` } };
    i++;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // delay for demonstration
  }
}

export { asyncObjectGenerator, run };
