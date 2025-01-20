export function defineFocusTrapElement(tagName = "focus-trap-element") {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, FocusTrapElement);
}

export class FocusTrapElement extends HTMLElement {
  static createSentinel(onFocus: EventListener) {
    const sentinel = document.createElement("span");
    sentinel.tabIndex = 0;
    sentinel.setAttribute("data-is-sentinel", "");
    sentinel.addEventListener("focus", onFocus);
    return sentinel;
  }

  connectedCallback() {
    this.append(
      FocusTrapElement.createSentinel(() => {
        this.queryFocusableChildren()[0]?.focus();
      })
    );
    this.prepend(
      FocusTrapElement.createSentinel(() => {
        [...this.queryFocusableChildren()].at(-1)?.focus();
      })
    );
  }

  private queryFocusableChildren() {
    const allowFilters = `:where(a[href], button, [contenteditable="true"], input, textarea, select, details, [tabindex]:not([tabindex="-1"])):not([data-is-sentinel])`;
    const blockFilters = `:not(dialog:not([open]) *)`;

    return this.querySelectorAll<HTMLElement>(`${allowFilters}${blockFilters}`);
  }
}
