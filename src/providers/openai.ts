import type {
  EasyInputMessage,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputItem,
  ResponseInputText,
  ResponseOutputText,
} from "openai/resources/responses/responses.mjs";
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
import { getOpenAIOptions } from "./shared";

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
  static defaultModels = [
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-chat-latest",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-codex",
  ];

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
        }) satisfies OpenAIConnection,
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

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isOpenAIConnection(connection)) throw new Error("Invalid connection type");
    const model = connection.model;
    return getOpenAIOptions(model);
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

      const options = that.getOptions(connection);

      const start = performance.now();
      const stream = client.responses.stream(
        {
          input: that.getOpenAIMessages(messages, { isSystemMessageSupported: true }),
          model: connection.model,
          tools: config.search ? [{ type: "web_search" }] : undefined,
          temperature: options.temperature !== undefined ? config?.temperature : undefined,
          ...(options.reasoningEffort
            ? { reasoning: { effort: (config.reasoningEffort ?? options.reasoningEffort.at(0)) as ReasoningEffort } }
            : {}),
          text: {
            ...(options.verbosity
              ? { verbosity: (config?.verbosity as "low" | "medium" | "high") ?? options.verbosity.at(0) }
              : {}),
          },
          max_output_tokens: config?.maxTokens,
          top_p: config?.topP,
          prompt_cache_key: "iter",
        },
        {
          signal: abortSignal,
        },
      );

      for await (const message of stream) {
        if (message.type === "response.output_text.delta" && message.delta) {
          yield message.delta;
        }
      }

      const finalUsage = (await stream.finalResponse()).usage;
      if (finalUsage) {
        config?.onMetadata?.({
          totalOutputTokens: finalUsage.output_tokens,
          durationMs: performance.now() - start,
        });
      }
    };
  }

  private getOpenAIMessages(
    messages: GenericMessage[],
    options?: {
      isSystemMessageSupported?: boolean;
    },
  ): ResponseInputItem[] {
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
                  return { type: "input_text", text: dataUrlToText(part.url) } satisfies ResponseInputText;
                } else if (part.type.startsWith("image/")) {
                  return {
                    type: "input_image",
                    detail: "auto",
                    image_url: part.url,
                  } satisfies ResponseInputImage;
                } else if (part.type === "application/pdf") {
                  return {
                    type: "input_file",
                    file_data: part.url,
                    filename: part.name,
                  } satisfies ResponseInputFile;
                } else {
                  const maybeTextFile = tryDecodeDataUrlAsText(part.url);
                  if (maybeTextFile) {
                    return {
                      type: "input_text",
                      text: `
\`\`\`${part.name ?? "unnamed"} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                      `.trim(),
                    } satisfies ResponseInputText;
                  }
                  throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
                }
              })
              .filter((part) => part !== null),
          } satisfies EasyInputMessage;
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
                type: "output_text",
                text: dataUrlToText(part.url),
              } as ResponseOutputText;
            } else {
              const maybeTextFile = tryDecodeDataUrlAsText(part.url);
              if (maybeTextFile) {
                const filePrefix = message.role === "user" ? "input" : "output";
                return {
                  type: "output_text",
                  text: `
\`\`\`${part.name ?? "unnamed"} ${filePrefix} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                  `.trim(),
                } as ResponseOutputText;
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
          } satisfies EasyInputMessage;
        }
        case "system":
          let finalRole: "developer" | "system" | "user" = "developer";
          if (!options?.isSystemMessageSupported) {
            console.error("System message is not supported for this model, converted to user message");
            finalRole = "user";
          }
          if (typeof message.content === "string") {
            return { role: finalRole, content: message.content } satisfies EasyInputMessage;
          } else {
            return {
              role: finalRole,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            } satisfies EasyInputMessage;
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m) => m !== null);
  }

  private isOpenAICredential(credential: BaseCredential): credential is OpenAICredential {
    return credential.type === "openai";
  }

  private isOpenAIConnection(connection: BaseConnection): connection is OpenAIConnection {
    return connection.type === "openai";
  }
}
