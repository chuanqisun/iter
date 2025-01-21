// a global instance to allow sharing chat provider between react and web components

import type { GenericChatParams } from "../providers/base";

export type GlobalChatProxy = (params: GenericChatParams) => AsyncGenerator<string>;
let chatInstance: GlobalChatProxy | undefined;

export function getChatInstance(): GlobalChatProxy {
  if (!chatInstance) throw new Error("Chat provider not initialized");
  return chatInstance;
}
export function setChatInstance(chat: GlobalChatProxy) {
  chatInstance = chat;
}
