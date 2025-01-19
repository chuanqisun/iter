import mermaid from "mermaid";

let id = 0;
export function runMermaid(trigger: HTMLElement, code?: string) {
  if (!code) return;

  const renderContainer = trigger.closest("artifact-element")?.querySelector("artifact-preview");
  if (!renderContainer) return;

  trigger.classList.add("running");
  const graphDefinition = code?.trim() ?? "";
  mermaid.parse(graphDefinition).then((ok) => {
    if (!ok) return;
    mermaid.render(`mermaid-preview-${++id}`, graphDefinition).then(({ svg, bindFunctions }) => {
      renderContainer.innerHTML = svg;
      bindFunctions?.(renderContainer);
    });
  });
}
