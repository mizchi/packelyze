import type { TypedFetch } from "@mizchi/zero-runtime";
import { $boolean, $object, $string, Infer } from "lizod";

export const validateSendBody = $object({
  keepMe: $string,
});

export const validateSendResponse = $object({
  ok: $boolean,
});

export type SendBody = Infer<typeof validateSendBody>;
export type SendResponse = Infer<typeof validateSendResponse>;

export const fetch = globalThis.fetch as TypedFetch<{
  "http://example.test": {
    "/send": {
      methodType: "POST";
      bodyType: SendBody;
      responseType: SendResponse;
      headersType: {
        "Content-Type": "application/json";
      };
    };
  };
}>;
