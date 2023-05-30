import { useState } from "react";

export function MyComponent(props: {
  xxxxxx: string;
}) {
  return <div>
    {props.xxxxxx}
    <Sub internal="1" />
  </div>;
}

// hidden
function Sub(props: {
  internal: string;
}) {
  return <div>{props.internal}</div>;
}