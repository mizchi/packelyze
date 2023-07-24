export function intersect(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}

export function union(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a, ...b]);
}

export function difference(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((x) => !b.has(x)));
}

export function isSubset(a: Set<string>, b: Set<string>): boolean {
  return [...a].every((x) => b.has(x));
}

export function isSuperset(a: Set<string>, b: Set<string>): boolean {
  return isSubset(b, a);
}

export function isDisjoint(a: Set<string>, b: Set<string>): boolean {
  return [...a].every((x) => !b.has(x));
}

export function toMappedSet<T, U>(set: Set<T>, map: (x: T) => U): Set<U> {
  return new Set([...set].map(map));
}

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
// ----- internal utility from typescript/src/compiler/core.ts --------

export interface MapLike<T> {
  [index: string]: T;
}
const hasOwnProperty = Object.prototype.hasOwnProperty;
export function getOwnValues<T>(collection: MapLike<T> | T[]): T[] {
  const values: T[] = [];
  for (const key in collection) {
    if (hasOwnProperty.call(collection, key)) {
      values.push((collection as MapLike<T>)[key]);
    }
  }
  return values;
}

export function sortBy<T>(array: T[], comparer: (t: T) => number): T[] {
  return array.slice().sort((a, b) => comparer(a) - comparer(b));
}
