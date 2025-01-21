export async function* getTaggedStream(stream: AsyncIterable<string>, tagName: string): AsyncGenerator<string> {
  let buffer = "";
  let isCollecting = false;
  const prefix = `<${tagName}>`;
  const suffix = `</${tagName}>`;

  for await (const chunk of stream) {
    buffer += chunk;

    while (true) {
      if (!isCollecting) {
        // Look for prefix
        const prefixIndex = buffer.indexOf(prefix);
        if (prefixIndex === -1) {
          // No prefix found, keep only the last (prefix.length - 1) characters
          // in case the prefix is split between chunks
          buffer = buffer.slice(-prefix.length + 1);
          break;
        }
        // Found prefix, start collecting from after it
        buffer = buffer.slice(prefixIndex + prefix.length);
        isCollecting = true;
      }

      if (isCollecting) {
        // Look for suffix
        const suffixIndex = buffer.indexOf(suffix);
        if (suffixIndex === -1) {
          // No suffix found yet, yield the safe part and keep the rest
          if (buffer.length > suffix.length) {
            const safeLength = buffer.length - suffix.length;
            yield buffer.slice(0, safeLength);
            buffer = buffer.slice(safeLength);
          }
          break;
        }
        // Found suffix, yield the content up to it
        yield buffer.slice(0, suffixIndex);
        buffer = buffer.slice(suffixIndex + suffix.length);
        isCollecting = false;
      }
    }
  }

  // Handle any remaining content if we're still collecting
  if (isCollecting && buffer.length > 0) {
    yield buffer;
  }
}
