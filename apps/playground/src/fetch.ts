import { $boolean, $object, $string, Infer } from "lizod";
import type { FetchRule, TypedFetch } from "zero-runtime";

export const validateSendBody = $object({
  keepMe: $string,
});

export const validateSendResponse = $object({
  ok: $boolean,
});

export type SendBody = Infer<typeof validateSendBody>;
export type SendResponse = Infer<typeof validateSendResponse>;

export const fetch = globalThis.fetch as TypedFetch<
  FetchRule<{
    $url: "http://example.test/send";
    $method: "POST";
    $body: SendBody;
    $response: SendResponse;
    $headers: {
      "Content-Type": "application/json";
    };
  }>
>;
