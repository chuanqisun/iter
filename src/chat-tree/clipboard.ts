import type { ChatPart } from './chat-tree';

export async function getParts(data?: DataTransfer): Promise<ChatPart[]> {
  const items = data?.items;
  if (!items) return [];


  const parts = await Promise.all([...items].map((async item => {
    const file = item.getAsFile();
    if (!file) return null;
    const reader = new FileReader();

    return new Promise<ChatPart>((resolve) => {
      reader.onload = () => resolve({
        name: file.name,
        type: file.type ? file.type : "text/plain",
        url: reader.result as string,
        size: file.size,
      });
      reader.readAsDataURL(file);
    });
  })));

  return parts.filter((part) => !!part);
}
