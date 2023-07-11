type ExportedType = {
  id: number;
  value: string;
};

type NonExportedType = {
  name: string;
  age: number;
};

export function run() {
  // Array destructuring
  const arr: ExportedType[] = [
    { id: 1, value: "one" },
    { id: 2, value: "two" },
    { id: 3, value: "three" },
  ];

  const [first, ...rest] = arr;

  // Object destructuring
  const obj: NonExportedType = {
    name: "John",
    age: 30,
  };

  const { name, age } = obj;

  // Return the results so they can be checked
  return { first, rest, name, age };
}
