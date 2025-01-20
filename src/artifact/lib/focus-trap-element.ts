export function defineFocusTrapElement(tagName = "focus-trap-element") {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, FocusTrapElement);
}

export class FocusTrapElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static createSentinel(onFocus: EventListener) {
    const sentinel = document.createElement("span");
    sentinel.tabIndex = 0;
    sentinel.setAttribute("data-is-sentinel", "");
    sentinel.addEventListener("focus", onFocus);
    return sentinel;
  }

  attributeChangedCallback(name: string, _oldValue: string, _newValue: string) {
    if (name === "disabled") {
      this.updateDisabled(this.hasAttribute("disabled"));
    }
  }

  private updateDisabled(isDisabled: boolean) {
    const sentinels = this.querySelectorAll<HTMLSpanElement>("[data-is-sentinel]");
    sentinels.forEach((s) => (s.tabIndex = isDisabled ? -1 : 0));
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

    this.updateDisabled(this.hasAttribute("disabled"));
  }

  private queryFocusableChildren() {
    const allowFilters = `:where(a[href], button, [contenteditable="true"], input, textarea, select, details, [tabindex]:not([tabindex="-1"])):not([data-is-sentinel])`;
    const blockFilters = `:not(dialog:not([open]) *)`;

    return this.querySelectorAll<HTMLElement>(`${allowFilters}${blockFilters}`);
  }
}
