import type { Base64PDFSource, DocumentBlockParam, ImageBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";
import { dataUrlToText } from "../storage/codec";
import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy, GenericChatParams, GenericMessage } from "./base";

export interface AnthropicCredential extends BaseCredential {
  id: string;
  type: "anthropic";
  accountName: string;
  apiKey: string;
}

export interface AnthropicConnection extends BaseConnection {
  id: string;
  type: "anthropic";
  displayGroup: string;
  displayName: string;
  model: string;
  apiVersion: string;
  apiKey: string;
}

export class AnthropicProvider implements BaseProvider {
  static type = "anthropic";
  static defaultModels = ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"];

  parseNewCredentialForm(formData: FormData): AnthropicCredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "anthropic",
        accountName: accountName?.length ? accountName : `anthropic-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): AnthropicConnection[] {
    if (!this.isAnthropicCredential(credential)) throw new Error("Invalid credential type");

    return AnthropicProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "anthropic",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
          apiVersion: "2023-06-01",
        } satisfies AnthropicConnection)
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isAnthropicCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: AnthropicProvider.defaultModels.join(","),
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isAnthropicConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const Anthropic = await import("@anthropic-ai/sdk").then((res) => res.Anthropic);
      const client = new Anthropic({ apiKey: connection.apiKey, dangerouslyAllowBrowser: true });

      const { system, messages: anthropicMessages } = that.getAnthropicMessages(messages);

      const stream = await client.messages.create(
        {
          max_tokens: config?.maxTokens ?? 200,
          temperature: Math.min(config?.temperature ?? 0.7, 1), // anthropic only supports 0-1
          system,
          messages: anthropicMessages,
          model: connection.model,
          stream: true,
        },
        {
          signal: abortSignal,
        }
      );

      for await (const message of stream) {
        if (message.type === "content_block_delta" && message.delta.type === "text_delta" && message.delta.text) {
          yield message.delta.text;
        }
      }
    };
  }

  private isAnthropicCredential(credential: BaseCredential): credential is AnthropicCredential {
    return credential.type === "anthropic";
  }

  private isAnthropicConnection(connection: BaseConnection): connection is AnthropicConnection {
    return connection.type === "anthropic";
  }

  private getAnthropicMessages(messages: GenericMessage[]): { system?: string; messages: MessageParam[] } {
    let system;
    const convertedMessages: MessageParam[] = [];

    messages.forEach((message) => {
      if (message.role === "system") {
        if (typeof message.content === "string") {
          system = message.content;
        } else {
          system = message.content
            .filter((part) => part.type === "text/plain")
            .map((part) => dataUrlToText(part.url))
            .join("\n");
        }
      } else if (typeof message.content === "string") {
        convertedMessages.push({
          role: message.role as "assistant" | "user",
          content: message.content,
        });
      } else {
        const convertedMessageParts = message.content.map((part) => {
          switch (part.type) {
            case "text/plain": {
              return {
                type: "text",
                text: dataUrlToText(part.url),
              } satisfies TextBlockParam;
            }
            case "application/pdf": {
              return {
                type: "document",
                source: {
                  ...this.dataUrlToDocumentPart(part.url),
                  type: "base64",
                },
                cache_control: { type: "ephemeral" },
              } satisfies DocumentBlockParam;
            }
            case "image/jpeg":
            case "image/png":
            case "image/gif":
            case "image/webp": {
              return {
                type: "image",
                source: {
                  ...this.dataUrlToImagePart(part.url),
                  type: "base64",
                },
              } satisfies ImageBlockParam;
            }
            default: {
              console.warn(`Unsupported content type: ${part.type}`);
              return null;
            }
          }
        });

        convertedMessages.push({
          role: message.role as "assistant" | "user",
          content: convertedMessageParts.filter((part) => part !== null),
        });
      }
    });

    return {
      system,
      messages: convertedMessages,
    };
  }

  private dataUrlToImagePart(dataUrl: string) {
    const split = dataUrl.split(",");
    const supportedTypes: ImageBlockParam["source"]["media_type"][] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const media_type = split[0].split(";")[0].split(":")[1] as ImageBlockParam["source"]["media_type"];
    if (!supportedTypes.includes(media_type)) throw new Error(`Unsupported media type: ${media_type}`);

    return {
      data: split[1],
      media_type,
    };
  }

  private dataUrlToDocumentPart(dataUrl: string) {
    const split = dataUrl.split(",");
    const supportedTypes: Base64PDFSource["media_type"][] = ["application/pdf"];
    const media_type = split[0].split(";")[0].split(":")[1] as Base64PDFSource["media_type"];
    if (!supportedTypes.includes(media_type)) throw new Error(`Unsupported media type: ${media_type}`);

    return {
      data: split[1],
      media_type,
    };
  }
}
