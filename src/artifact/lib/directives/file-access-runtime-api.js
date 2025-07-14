globalThis.readonlyFS = {
  async getFile(filename) {
    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "readFileRequest", filename }, "*");
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event) => {
          if (event.data.type === "readFileResponse" && event.data.filename === filename) {
            resolve(event.data.file);
            abortController.abort();
          }
        },
        { signal: abortController.signal },
      );
    });
  },
};

globalThis.writeonlyFS = {
  async writeFile(filename, textOrBlob) {
    const writableContent =
      typeof textOrBlob === "string"
        ? textOrBlob
        : await textOrBlob.arrayBuffer().then((buffer) => new Uint8Array(buffer));

    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "writeFileRequest", filename, data: writableContent }, "*");
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event) => {
          if (event.data.type === "writeFileResponse" && event.data.filename === filename) {
            resolve();
            abortController.abort();
          }
        },
        { signal: abortController.signal },
      );
    });
  },
};

globalThis.editor = {
  async readContent() {
    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "readContentRequest" }, "*");
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event) => {
          if (event.data.type === "readContentResponse") {
            resolve(event.data.content);
            abortController.abort();
          }
        },
        { signal: abortController.signal },
      );
    });
  },
  async writeContent(content) {
    return new Promise((resolve, reject) => {
      window.parent.postMessage({ type: "writeContentRequest", content }, "*");
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event) => {
          if (event.data.type === "writeContentResponse") {
            resolve();
            abortController.abort();
          }
        },
        { signal: abortController.signal },
      );
    });
  },
};
