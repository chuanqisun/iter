export async function getParts(data?: DataTransfer): Promise<{ name: string, url: string }[]> {
  const items = data?.items;
  if (!items) return [];


  const parts = await Promise.all([...items].map((async item => {
    const file = item.getAsFile();
    if (!file) return null;
    const reader = new FileReader();

    return new Promise<{ name: string, url: string }>((resolve) => {
      reader.onload = () => resolve({
        name: file.name,
        url: reader.result as string
      });
      reader.readAsDataURL(file);
    });
  })));

  return parts.filter((part): part is { name: string, url: string } => !!part);
}
