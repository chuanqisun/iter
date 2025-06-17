globalThis.llm = {
  async prompt(prompt) {
    return new Promise((resolve, _reject) => {
      const requestId = Math.random().toString(36).substring(2, 15);
      window.parent.postMessage({ type: "llmPromptRequest", prompt, requestId }, "*");
      const abortController = new AbortController();
      window.addEventListener(
        "message",
        (event) => {
          if (event.data.type === "llmPromptResponse" && event.data.requestId === requestId) {
            resolve(event.data.response);
            abortController.abort();
          }
        },
        { signal: abortController.signal },
      );
    });
  },

  async abortAll() {
    window.parent.postMessage({ type: "llmAbortAllRequest" }, "*");
  },
};
