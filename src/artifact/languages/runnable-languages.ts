export const scriptingLanguages = ["typescript", "javascript", "jsx", "tsx", "js", "ts"];
export const mermaidLanguages = ["mermaid", "mmd"];
export const xmlLanguages = ["html", "xml", "svg"];
export const markdownLanguages = ["markdown", "md"];

export const runnableArtifactLanguages = new Set([
  ...scriptingLanguages,
  ...mermaidLanguages,
  ...xmlLanguages,
  ...markdownLanguages,
]);
