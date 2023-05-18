export function createManglePropertiesRegexString(props: Set<string>) {
  const props_regex = Array.from(props).join("|");
  return `^(?!(${props_regex})).*`;
}

