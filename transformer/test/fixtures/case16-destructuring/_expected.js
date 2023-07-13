function run() {
  // Array destructuring
  const j = [
    { id: 1, value: "one" },
    { id: 2, value: "two" },
    { id: 3, value: "three" },
  ];
  const [q, ...z] = j;
  // Object destructuring
  const p = {
    k: "John",
    x: 30,
  };
  const { k: name, x: age } = p;
  // Return the results so they can be checked
  return { first: q, rest: z, name, age };
}

export { run };
