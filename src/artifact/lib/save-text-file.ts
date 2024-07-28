export function saveTextFile(mimeType: string, extension: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `artifact-${new Date().toISOString()}.${extension}`;
  anchor.click();
}
