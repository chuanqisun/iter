export function saveTextFile(mimeType: string, extension: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  const timestamp = new Date()
    .toISOString()
    .split(".")[0]
    .replace(/[-T:.]/g, "");
  anchor.download = `artifact-${timestamp}.${extension}`;
  anchor.click();
}
