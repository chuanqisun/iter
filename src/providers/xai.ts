import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/index.mjs";
import type { ReasoningEffort } from "openai/resources/shared.mjs";
import { dataUrlToText, tryDecodeDataUrlAsText } from "../storage/codec";
import type {
  BaseConnection,
  BaseCredential,
  BaseProvider,
  ChatStreamProxy,
  GenericChatParams,
  GenericMessage,
  GenericOptions,
} from "./base";

export interface XAICredential extends BaseCredential {
  id: string;
  type: "xai";
  accountName: string;
  apiKey: string;
}

export interface XAIConnection extends BaseConnection {
  id: string;
  type: "xai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export class XAIProvider implements BaseProvider {
  static type = "xai";
  static defaultModels = ["grok-4", "grok-3-fast", "grok-3", "grok-3-mini-fast", "grok-3-mini"];

  parseNewCredentialForm(formData: FormData): XAICredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "xai",
        accountName: accountName?.length ? accountName : `xai-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): XAIConnection[] {
    if (!this.isXaiCredential(credential)) throw new Error("Invalid credential type");

    return XAIProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "xai",
          displayGroup: credential.accountName,
          displayName: model,
          model,
          apiKey: credential.apiKey,
        }) satisfies XAIConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isXaiCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: XAIProvider.defaultModels.join(","),
    };
  }

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isXaiConnection(connection)) throw new Error("Invalid connection type");
    const model = connection.model;

    const isThinkingEffortSupported = model.startsWith("grok-3-mini");

    return {
      temperature: { max: 2 },
      reasoningEffort: isThinkingEffortSupported ? ["low", "high"] : undefined,
    };
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isXaiConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const OpenAI = await import("openai").then((res) => res.OpenAI);
      const client = new OpenAI({
        apiKey: connection.apiKey,
        baseURL: "https://api.x.ai/v1",
        dangerouslyAllowBrowser: true,
      });

      const options = that.getOptions(connection);

      const isSystemMessageSupported = !connection.model.startsWith("o1-mini");

      const start = performance.now();
      const stream = await client.chat.completions.create(
        {
          stream: true,
          stream_options: {
            include_usage: true,
          },
          messages: that.getXAIMessages(messages, { isSystemMessageSupported }),
          model: connection.model,
          temperature: options.temperature !== undefined ? config?.temperature : undefined,
          ...(options.reasoningEffort
            ? { reasoning: { effort: (config.reasoningEffort ?? "low") as ReasoningEffort } }
            : {}),
          max_completion_tokens: config?.maxTokens,
          top_p: config?.topP,
          user: "iter", // HACK: this seems to significantly improve cache hit rate
        },
        {
          signal: abortSignal,
        },
      );

      for await (const chunk of stream) {
        const content = chunk.choices.at(0)?.delta?.content;
        if (content) yield content;
        if (chunk.usage) {
          config?.onMetadata?.({
            totalOutputTokens:
              (chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0) + chunk.usage.completion_tokens,
            durationMs: performance.now() - start,
          });
        }
      }
    };
  }

  private getXAIMessages(
    messages: GenericMessage[],
    options?: {
      isSystemMessageSupported?: boolean;
    },
  ): ChatCompletionMessageParam[] {
    const convertedMessage = messages.map((message) => {
      switch (message.role) {
        case "user": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };

          return {
            role: message.role,
            content: message.content
              .map((part) => {
                if (part.type === "text/plain" && !part.name) {
                  // unnamed message is the main body text
                  return { type: "text", text: dataUrlToText(part.url) } satisfies ChatCompletionContentPartText;
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "image_url",
                    image_url: { url: part.url },
                  } satisfies ChatCompletionContentPartImage;
                } else if (part.type === "application/pdf") {
                  return {
                    type: "file",
                    file: {
                      file_data: part.url,
                      filename: part.name,
                    },
                  } satisfies ChatCompletionContentPart.File;
                } else {
                  const maybeTextFile = tryDecodeDataUrlAsText(part.url);
                  if (maybeTextFile) {
                    return {
                      type: "text",
                      text: `
\`\`\`${part.name ?? "unnamed"} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                      `.trim(),
                    } satisfies ChatCompletionContentPartText;
                  }
                  throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
                }
              })
              .filter((part) => part !== null),
          } satisfies ChatCompletionUserMessageParam;
        }
        case "assistant": {
          if (typeof message.content === "string") return { role: message.role, content: message.content };
          if (message.content.length === 0) return { role: message.role, content: "" };
          if (message.content.length === 1 && message.content[0].type === "text/plain") {
            return { role: message.role, content: dataUrlToText(message.content[0].url) };
          }

          const corcedOutputTexts = message.content.map((part) => {
            if (part.type === "text/plain") {
              return {
                type: "text",
                text: dataUrlToText(part.url),
              } as ChatCompletionContentPartText;
            } else {
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                return {
                  type: "text",
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                  `.trim(),
                } as ChatCompletionContentPartText;
              }
              throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
            }
          });

          if (!corcedOutputTexts.length) {
            console.warn(`Unable to format assistant message content`, message.content);
            return null;
          }

          return {
            role: message.role,
            content: corcedOutputTexts as any[],
          } satisfies ChatCompletionAssistantMessageParam;
        }
        case "system":
          let finalRole: "system" | "user" = "system";
          if (!options?.isSystemMessageSupported) {
            console.error("System message is not supported for this model, converted to user message");
            finalRole = "user";
          }
          if (typeof message.content === "string") {
            return { role: finalRole, content: message.content } satisfies
              | ChatCompletionSystemMessageParam
              | ChatCompletionUserMessageParam;
          } else {
            return {
              role: finalRole,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            } satisfies ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam;
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m) => m !== null);
  }

  private isXaiCredential(credential: BaseCredential): credential is XAICredential {
    return credential.type === "xai";
  }

  private isXaiConnection(connection: BaseConnection): connection is XAIConnection {
    return connection.type === "xai";
  }
}
