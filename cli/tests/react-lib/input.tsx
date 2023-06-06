import { useRef } from "react";

export function MyApp(props: {title: string}) {
  const ref = useRef<HTMLInputElement>(null);
  
  return <div ref={ref} style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    <h1>{props.title}</h1>
    <Sub internal={42} />
  </div>
}

function Sub(props: {internal: number}) {
  return <span>{props.internal}</span>
}