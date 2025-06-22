import mermaid from "mermaid";

let id = 0;
export function runMermaid(preview?: HTMLElement, code?: string) {
  if (!code) return;
  if (!preview) return;

  const graphDefinition = code?.trim() ?? "";
  mermaid.parse(graphDefinition).then((ok) => {
    if (!ok) return;
    mermaid.render(`mermaid-preview-${++id}`, graphDefinition).then(({ svg, bindFunctions }) => {
      preview.innerHTML = svg;
      bindFunctions?.(preview);
    });
  });
}
