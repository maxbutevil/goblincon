// Taking png images as an example
declare module '*.png' {
  const content: string;
  export default content;
}