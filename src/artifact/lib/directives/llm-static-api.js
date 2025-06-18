globalThis.llm = {
  async prompt(_prompt) {
    throw new Error(
      "The llm.prompt function is not available in the exported artifact. You can only use it in the runtime environment.",
    );
  },

  async abortAll() {
    // noop
  },
};
