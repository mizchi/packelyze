import { MyComponent } from "@internal/react-lib";
// import { MyComponent } from "./external";

import { createRoot } from "react-dom/client"

const root = document.getElementById("root")!;
createRoot(root).render(<MyComponent xxxxxx={'eee'} />);