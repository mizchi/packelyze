import { useContext } from "react";

export function MyComponent(props: {
  xxxxxx: string;
}) {
  useContext
  return <div>
    <Sub internal="1" />
    {props.xxxxxx}
  </div>;
}

// hidden
function Sub(props: {
  internal: string;
}) {
  return <div>{props.internal}</div>;
}