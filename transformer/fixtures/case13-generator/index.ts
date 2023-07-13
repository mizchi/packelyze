type NestedObject = {
  id: number;
  data: {
    value: string;
  };
};

// Generator function
function* objectGenerator(): Generator<{ foo: number }> {
  let i = 0;
  while (true) {
    yield { foo: i };
    i++;
  }
}

export function run() {
  for (const obj of objectGenerator()) {
    console.log(obj.foo);
  }
}

// Async generator function
export async function* asyncObjectGenerator(): AsyncGenerator<NestedObject> {
  let i = 0;
  while (true) {
    yield { id: i, data: { value: `Value ${i}` } };
    i++;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // delay for demonstration
  }
}
