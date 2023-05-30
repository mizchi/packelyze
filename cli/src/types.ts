import { $array, $enum, $object, $opt, $string, type Infer } from "lizod";
type Builtin = "dom" | "browser" | "worker" | "domprops";

export const validateOptoolsConfig = $object({
  input: $string,
  output: $string,
  bultins: $opt($array($enum(["dom", "browser", "worker", "domprops"]))),
  external: $opt($array($string)),
});

export type OptoolsConfig = Infer<typeof validateOptoolsConfig>;
