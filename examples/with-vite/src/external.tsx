export function MyComponent(props: {
  xxxxxx: string;
}) {
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