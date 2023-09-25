import type { TypedJSON$stringify, TypedResponse, TypedResponseConstructor } from "zero-runtime";

type T = { x: number };

const stringify = JSON.stringify as TypedJSON$stringify;
const Response = globalThis.Response as unknown as TypedResponseConstructor;

const x = {
  async fetch(): Promise<TypedResponse<T>> {
    // return Response.json
    return new Response<T>(stringify({ x: 1 }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};

export default x;
