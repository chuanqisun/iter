globalThis.readonlyFS = {
  async getFile(filename) {
    const script = document.querySelector(`script[type="embedded-file"][filename="${filename}"]`);
    if (!script) {
      throw new Errol(`File not found: ${filename}`);
    }
    const data = script.getAttribute("data");
    // fetch dataUrl into File object
    const blob = await (await fetch(data)).blob();
    const file = new File([blob], filename, { type: blob.type });
    return file;
  },
};

globalThis.writeonlyFS = {
  async writeFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
