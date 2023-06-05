import { $array, $enum, $object, $opt, $string, type Infer } from "lizod";

export const validateOptoolsConfig = $object({
  input: $string,
  output: $string,
  ambient: $opt($array($string)),
  bultins: $array($enum(["dom", "browser", "worker", "domprops"])),
  external: $array($string),
}, false);

export type OptoolsConfig = Infer<typeof validateOptoolsConfig>;
