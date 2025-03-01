import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { dataUrlToText } from "../storage/codec";
import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy, GenericChatParams, GenericMessage } from "./base";

export interface OpenAICredential extends BaseCredential {
  id: string;
  type: "openai";
  accountName: string;
  apiKey: string;
}

export interface OpenAIConnection extends BaseConnection {
  id: string;
  type: "openai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class OpenAIProvider implements BaseProvider {
  static type = "openai";
  static defaultModels = ["gpt-4.5-preview", "o3-mini", "o1-mini", "gpt-4o", "gpt-4o-mini"];

  parseNewCredentialForm(formData: FormData): OpenAICredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "openai",
        accountName: accountName?.length ? accountName : `openai-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): OpenAIConnection[] {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return OpenAIProvider.defaultModels.map(
      (model) =>
      ({
        id: `${model}:${credential.id}`,
        type: "openai",
        displayGroup: credential.accountName,
        displayName: model,
        model,
        apiKey: credential.apiKey,
      } satisfies OpenAIConnection)
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isOpenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: OpenAIProvider.defaultModels.join(","),
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isOpenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const OpenAI = await import("openai").then((res) => res.OpenAI);
      const client = new OpenAI({
        apiKey: connection.apiKey,
        dangerouslyAllowBrowser: true,
      });

      const supportsTemperature = !connection.model.startsWith("o1") && !connection.model.startsWith("o3");

      const stream = await client.chat.completions.create(
        {
          stream: true,
          messages: that.getOpenAIMessages(messages),
          model: connection.model,
          temperature: supportsTemperature ? config?.temperature : undefined,
          max_completion_tokens: config?.maxTokens,
          top_p: config?.topP,
        },
        {
          signal: abortSignal,
        }
      );

      for await (const message of stream) {
        const deltaText = message.choices?.at(0)?.delta?.content;
        if (deltaText) yield deltaText;
      }
    };
  }

  private getOpenAIMessages(messages: GenericMessage[]): ChatCompletionMessageParam[] {
    const convertedMessage = messages.map((message) => {
      switch (message.role) {
        case "user":
        case "assistant": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };

          return {
            role: message.role,
            content: message.content
              .map((part) => {
                if (part.type === "text/plain") {
                  return { type: "text", text: dataUrlToText(part.url) } satisfies ChatCompletionContentPartText;
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.url,
                    },
                  } satisfies ChatCompletionContentPartImage;
                } else {
                  console.warn("Unsupported message part", part);
                  return null;
                }
              })
              .filter((part) => part !== null),
          };
        }
        case "system":
          if (typeof message.content === "string") {
            return { role: "developer", content: message.content };
          } else {
            return {
              role: "developer",
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            };
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m) => m !== null) as ChatCompletionMessageParam[];
  }

  private isOpenAICredential(credential: BaseCredential): credential is OpenAICredential {
    return credential.type === "openai";
  }

  private isOpenAIConnection(connection: BaseConnection): connection is OpenAIConnection {
    return connection.type === "openai";
  }
}
