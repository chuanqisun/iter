export function runIframe(trigger: HTMLElement, code?: string) {
  if (!code) return;

  const renderContainer = trigger.closest("artifact-element")?.querySelector("artifact-preview");
  if (!renderContainer) return;

  if (trigger.classList.contains("running")) {
    trigger.classList.remove("running");
    renderContainer.innerHTML = "";
  } else {
    trigger.classList.add("running");
    const iframe = document.createElement("iframe");
    iframe.srcdoc = code;
    iframe.frameBorder = "0";
    // resize onload
    iframe.onload = (e) => {
      const iframe = e.target as HTMLIFrameElement;
      const calculatedHeight = Math.max(iframe.contentWindow?.document.documentElement.scrollHeight ?? 320, 320);
      iframe.style.height = `${calculatedHeight}px`;
    };
    renderContainer.innerHTML = "";
    renderContainer.appendChild(iframe);
  }
}
