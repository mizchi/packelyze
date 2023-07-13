export type PublicType = {
  id: number;
  pubValue: string;
};

type InternalType = {
  name: string;
  age: number;
};

export function publicFunction(pub: PublicType): string {
  return `${pub.id}: ${pub.pubValue}`;
}

function internalFunction(internal: InternalType): string {
  return `${internal.name}: ${internal.age}`;
}

export function allExportedFunction(pub: PublicType, internal: InternalType): string {
  return publicFunction(pub) + ", " + internalFunction(internal);
}
