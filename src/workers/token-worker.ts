/// <reference lib="webworker" />

import { countTokens } from "gpt-tokenizer/model/gpt-4o";

export async function main() {
  self.onmessage = async (event) => {
    const text = event.data?.text;
    if (text === undefined) return;

    const tokenCount = countTokens(text);

    const replyPort = event.ports[0];
    replyPort.postMessage({ tokenCount });
  };
}

main();
