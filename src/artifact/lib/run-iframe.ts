export function runIframe(preview?: HTMLElement, code?: string) {
  if (!code) return;
  if (!preview) return;
  renderIframe(code, preview);
}

function renderIframe(code: string, renderContainer: HTMLElement) {
  const iframe = document.createElement("iframe");
  iframe.srcdoc = code;
  iframe.frameBorder = "0";
  renderContainer.innerHTML = "";
  renderContainer.appendChild(iframe);
}
