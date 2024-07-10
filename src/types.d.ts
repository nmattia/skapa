declare module "@jscadui/3mf-export";

declare module "*.wasm?url";

declare module "*?raw" {
  const content: string;
  export default content;
}
