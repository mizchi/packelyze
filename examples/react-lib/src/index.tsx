import { useEffect, useRef } from "react";

export function MyComponent(props: {
  xxxxxx: string;
}): JSX.Element {
  // useState(1);
  const ref = useRef<null | HTMLDivElement>(null);
  useEffect(() => {
    // keep this
    if (ref.current) {
      ref.current.innerHTML = "Hello World";
    }
  }, [
    ref.current
  ]);

  return <div ref={ref}>
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