export type NestedType = {
  id: number;
  nestedValue: string;
};

export function nestedFunction(nested: NestedType): string {
  return `${nested.id}: ${nested.nestedValue}`;
}
