import { test, expect } from "vitest";
import { Graph, topoSort } from "./utils";

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
