export async function getFirstImageDataUrl(data?: DataTransfer): Promise<string | undefined> {
  const items = data?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") === -1) continue;
    const blob = item.getAsFile();
    if (!blob) continue;
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }
}
