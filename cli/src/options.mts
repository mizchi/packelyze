import { $array, $enum, $object, $opt, $string, type Infer } from "lizod";

export const validateOptoolsConfig = $object({
  input: $string,
  output: $string,
  bultins: $array($enum(["dom", "browser", "worker", "domprops"])),
  external: $array($string),
});

export type OptoolsConfig = Infer<typeof validateOptoolsConfig>;
