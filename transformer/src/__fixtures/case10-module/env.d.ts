// src/index.d.ts

// Ambient module declaration
declare module "externalModule" {
  export function getExternalMessage(): string;
}

// Declare an existing module
declare module "lodash" {
  export function myCustomFunction(): string;
}

// types/myModule.d.ts
declare module "myModule" {
  export function myFunction(input: string): string;
}
