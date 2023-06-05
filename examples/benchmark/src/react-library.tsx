import { createContext } from "react";

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

// Rogic Component
const DataContext = createContext<{ value: number}>({ value: 0 });
function RootProvider(props: {children: React.ReactElement}) {
  return <DataContext.Provider value={{ value: 1 }}>
    {props.children}
    </DataContext.Provider>
}

// Layout Component
function RootLayout(props: {
  header: React.ReactElement;
  content: React.ReactElement;
  footer: React.ReactElement;
}) {
  return <div style={{
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    display: "grid",
    gridTemplateAreas: "'header' 'content' 'footer'",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "100px 1fr 300px"
  }}>
    <div style={{gridArea: "header"}}>{props.header}</div>
    <div style={{gridArea: "content"}}>{props.content}</div>
    <div style={{gridArea: "content"}}>{props.footer}</div>
  </div>
}

// Inline Component
function Title() {
  return <div>Hello, Example</div>;
}

// Block Component
function HeaderBlock() {
  return <div style={{
    width: "100%",
    height: "100%",
    margin: "0",
    padding: "0",
    display: "flex",
  }}>Header</div>;
}

// Block Component
function ContentBlock() {
  return <div style={{
    width: "100%",
    height: "100%",
    margin: "0",
    padding: "0",
    display: "flex",
  }}>
    <Title />
    Conent
  </div>;
}

// Block Component
function FooterBlock() {
  return <div style={{
    width: "100%",
    height: "100%",
    margin: "0",
    padding: "0",
    display: "flex",
  }}>
    Footer
  </div>;
}

// Root Component
export function App() {
  return <RootProvider>
    <RootLayout
      header={<HeaderBlock />}
      content={<ContentBlock />}
      footer={<FooterBlock />}
    />
  </RootProvider>
}