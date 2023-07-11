import { jsxs, jsx } from "react/jsx-runtime";
function MyComponent(props) {
  return jsxs("div", {
    children: [
      jsx("h1", { children: "MyComponent" }),
      jsx("div", { children: props.foo }),
      jsx("div", { children: props.children }),
      jsx(SubComponent, { value: props.foo }),
    ],
  });
}

function SubComponent(props) {
  return jsxs("div", {
    children: [
      jsx("h1", { children: "SubComponent" }),
      jsx("div", { children: props.value }),
    ],
  });
}

export { MyComponent };