function run() {
  // Array destructuring
  const arr = [
    { id: 1, value: "one" },
    { id: 2, value: "two" },
    { id: 3, value: "three" },
  ];
  const [/*first*/ j, ...rest] = arr;
  // Object destructuring
  const obj = {
    /*name*/ k: "John",
    /*age*/ x: 30,
  };
  const { /*name*/ k: name, /*age*/ x: age } = obj;
  // Return the results so they can be checked
  return { first: /*first*/ j, rest, name, age };
}

export { run };
