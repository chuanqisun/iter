export function runIframe(trigger: HTMLElement, code?: string) {
  if (!code) return;

  const renderContainer = trigger.closest("artifact-element")?.querySelector<HTMLElement>("artifact-preview");
  if (!renderContainer) return;

  trigger.classList.add("running");
  renderIframe(code, renderContainer);
}

export function updateIframe(trigger: HTMLElement, code: string) {
  const renderContainer = trigger.closest("artifact-element")?.querySelector<HTMLElement>("artifact-preview");
  if (!renderContainer) return;
  renderIframe(code, renderContainer);
}

function renderIframe(code: string, renderContainer: HTMLElement) {
  const iframe = document.createElement("iframe");
  iframe.srcdoc = code;
  iframe.frameBorder = "0";
  renderContainer.innerHTML = "";
  renderContainer.appendChild(iframe);
}
