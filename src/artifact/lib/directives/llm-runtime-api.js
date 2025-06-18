globalThis.llm = {
  async prompt(prompt) {
    return new Promise((resolve, _reject) => {
      const requestId = Math.random().toString(36).substring(2, 15);
      window.parent.postMessage({ type: "llmPromptRequest", prompt, requestId }, "*");
      console.log(`submitting prompt: ${prompt.slice(0, 16)}...`);
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
    console.log("abort all prompts", prompt?.slice(0, 64));
  },
};

// cancel pending requests when iframe unload
window.addEventListener("unload", () => {
  console.log("will abort all requests");
  window.parent.postMessage({ type: "llmAbortAllRequest" }, "*");
});
