import { useEffect, useRef, type RefObject } from "react";

const SCROLL_BOTTOM_TOLERANCE_PX = 120;

export function useKeepBodyScrolledToBottom(contentRef: RefObject<HTMLElement | null>) {
  const isPinnedToBottomRef = useRef(true);

  useEffect(() => {
    const scrollElement = document.scrollingElement;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return;

    let previousScrollTop = scrollElement.scrollTop;

    const updatePinnedState = () => {
      const scrollTop = scrollElement.scrollTop;
      if (scrollTop < previousScrollTop) {
        isPinnedToBottomRef.current = false;
        previousScrollTop = scrollTop;
        return;
      }

      const distanceFromBottom = scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;
      isPinnedToBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_TOLERANCE_PX;
      previousScrollTop = scrollTop;
    };

    updatePinnedState();

    const resizeObserver = new ResizeObserver(() => {
      if (!isPinnedToBottomRef.current) return;
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: "instant" });
    });

    resizeObserver.observe(contentElement);
    window.addEventListener("scroll", updatePinnedState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updatePinnedState);
    };
  }, [contentRef]);
}
