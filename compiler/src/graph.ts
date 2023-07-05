export type Graph<T> = Map<T, Set<T>>;

export function topoSort<T>(graph: Graph<T>, onCircularDep?: (t: T) => void): Array<T> {
  const result: Array<T> = [];
  const visited: Set<T> = new Set();
  const tempVisited: Set<T> = new Set();
  function visit(node: T) {
    if (tempVisited.has(node)) {
      onCircularDep?.(node);
      return;
    }
    if (visited.has(node)) {
      return;
    }

    tempVisited.add(node);

    const dependencies = graph.get(node);
    if (dependencies) {
      for (const dependency of dependencies) {
        visit(dependency);
      }
    }
    visited.add(node);
    tempVisited.delete(node);
    result.unshift(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return result.reverse();
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test("topoSort", () => {
    const graph: Graph<string> = new Map([
      ["A", new Set(["B", "C"])],
      ["B", new Set(["D", "E"])],
      ["C", new Set(["F"])],
      ["D", new Set(["G"])],
      ["E", new Set()],
      ["F", new Set(["E"])],
    ]);
    const sortedItems: Array<string> = topoSort(graph);
    expect(sortedItems).toEqual(["G", "D", "E", "B", "F", "C", "A"]);
  });

  test("topoSort with circular", () => {
    const graph: Graph<string> = new Map([
      ["A", new Set(["B", "C"])],
      ["B", new Set(["D", "E"])],
      ["C", new Set(["F"])],
      ["D", new Set(["G"])],
      ["E", new Set()],
      ["F", new Set(["E"])],
      ["G", new Set(["A"])], // circular deps
    ]);
    let circulars: string[] = [];
    const sortedItems: Array<string> = topoSort(graph, (t) => {
      circulars.push(t);
    });
    expect(sortedItems).toEqual(["G", "D", "E", "B", "F", "C", "A"]);
    expect(circulars).toEqual(["A"]);
  });
}
