export interface Citation {
  url: string;
  title?: string;
}

export function formatReferences(citations: Citation[]): string | undefined {
  if (citations.length === 0) return undefined;

  const uniqueCitations = Array.from(new Map(citations.map((c) => [c.url, c])).values());
  const references = uniqueCitations
    .map((c, i) => {
      const title = c.title || c.url || "Untitled";
      return `${i + 1}. [${title}](${c.url})`;
    })
    .join("\n");

  return `\n\n## References\n\n${references}`;
}
