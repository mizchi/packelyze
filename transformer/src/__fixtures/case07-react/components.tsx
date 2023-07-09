export function MyComponent(props: {
  foo: number,
  children: React.ReactNode;
}) {
  return <div>
    <h1>MyComponent</h1>
    <div>{props.foo}</div>
    <div>{props.children}</div>
    <SubComponent value={props.foo} />
  </div>;
}

function SubComponent(props: {
  value: number;
}) {
  return <div>
    <h1>SubComponent</h1>
    <div>{props.value}</div>
  </div>;
}