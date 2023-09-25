import { useState } from "react";

export function MyComponent(props: {
  xxxxxx: string;
}) {
  return (
    <div>
      {props.xxxxxx}
      <Sub internal="1" />
    </div>
  );
}

// hidden
function Sub(props: {
  internal: string;
}) {
  const [count, setCount] = useState(0);
  return (
    <button
      onClick={() => {
        setCount(count + 1);
      }}
    >
      {count}
    </button>
  );
}
