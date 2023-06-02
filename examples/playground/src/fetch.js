import { $boolean, $object, $string } from "lizod";
export const validateSendBody = $object({
    keepMe: $string,
});
export const validateSendResponse = $object({
    ok: $boolean,
});
export const fetch = globalThis.fetch;
