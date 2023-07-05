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
