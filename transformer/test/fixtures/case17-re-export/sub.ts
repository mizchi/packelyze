export type SubType = {
  id: number;
  subValue: string;
};

export function subFunction(sub: SubType): string {
  return `${sub.id}: ${sub.subValue}`;
}
