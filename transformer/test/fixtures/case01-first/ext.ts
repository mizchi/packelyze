import { join } from "node:path";
export function ext(a: string, b: string) {
  const flocal = "x";
  return join(a, b, flocal);
}
