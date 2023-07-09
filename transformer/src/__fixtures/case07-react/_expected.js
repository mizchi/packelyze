import { jsxs, jsx } from "react/jsx-runtime";
function MyComponent(props) {
  return jsxs("div", {
    children: [
      jsx("h1", { children: "MyComponent" }),
      jsx("div", { children: props.foo }),
      jsx("div", { children: props.children }),
      jsx(k, { value: props.foo }),
    ],
  });
}

function k(x) {
  return jsxs("div", {
    children: [
      jsx("h1", { children: "SubComponent" }),
      jsx("div", { children: x.j }),
    ],
  });
}

export { MyComponent };