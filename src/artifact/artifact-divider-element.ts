import "./artifact-divider-element.css";

export interface ArtifactDividerResizeIntent {
  /** The requested divider position in viewport coordinates. */
  clientX: number;
}

declare global {
  interface HTMLElementEventMap {
    "artifact-divider-resize": CustomEvent<ArtifactDividerResizeIntent>;
  }
}

export class ArtifactDividerElement extends HTMLElement {
  private activePointerId: number | undefined;
  private pointerOffset = 0;
  private connection?: AbortController;

  static define() {
    if (customElements.get("artifact-divider-element")) return;
    customElements.define("artifact-divider-element", ArtifactDividerElement);
  }

  connectedCallback() {
    if (this.connection) return;

    this.connection = new AbortController();
    const options = { signal: this.connection.signal };

    this.addEventListener("pointerdown", this.handlePointerDown, options);
    this.addEventListener("pointermove", this.handlePointerMove, options);
    this.addEventListener("pointerup", this.handlePointerEnd, options);
    this.addEventListener("pointercancel", this.handlePointerEnd, options);
    this.addEventListener("lostpointercapture", this.handlePointerEnd, options);
    window.addEventListener("blur", this.handleWindowBlur, options);
  }

  disconnectedCallback() {
    this.stopResizing();
    this.connection?.abort();
    this.connection = undefined;
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || this.activePointerId !== undefined) return;

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.pointerOffset = event.clientX - this.getBoundingClientRect().left;
    this.setPointerCapture(event.pointerId);
    this.setAttribute("data-resizing", "");
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointerId) return;
    if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
      this.stopResizing(event.pointerId);
      return;
    }

    this.dispatchEvent(
      new CustomEvent<ArtifactDividerResizeIntent>("artifact-divider-resize", {
        detail: { clientX: event.clientX - this.pointerOffset },
      }),
    );
  };

  private handlePointerEnd = (event: PointerEvent) => this.stopResizing(event.pointerId);
  private handleWindowBlur = () => this.stopResizing();

  private stopResizing(pointerId = this.activePointerId) {
    if (pointerId === undefined || pointerId !== this.activePointerId) return;

    this.activePointerId = undefined;
    this.removeAttribute("data-resizing");

    if (this.hasPointerCapture(pointerId)) {
      this.releasePointerCapture(pointerId);
    }
  }
}
