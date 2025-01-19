export function autoFocusNthInput(index: number) {
  const targetInput = [...document.querySelectorAll<HTMLTextAreaElement>("textarea:last-of-type")].at(index);
  if (!targetInput) return;

  targetInput.focus();
  targetInput.scrollIntoView();
}
