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

export interface InceptionCredential extends BaseCredential {
  id: string;
  type: "inception";
  accountName: string;
  apiKey: string;
}

export interface InceptionConnection extends BaseConnection {
  id: string;
  type: "inception";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

interface InceptionMessage {
  role: "system" | "user" | "assistant";
  content: string | InceptionContentPart[];
}

interface InceptionContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

interface InceptionChatCompletionRequest {
  model: string;
  messages: InceptionMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
}

interface InceptionStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export class InceptionProvider implements BaseProvider {
  static type = "inception";
  static defaultModels = ["mercury", "mercury-coder"];

  parseNewCredentialForm(formData: FormData): InceptionCredential[] {
    const accountName = formData.get("newAccountName") as string;

    /* YYYYMMDDHHMMSS */
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

    return [
      {
        id: crypto.randomUUID(),
        type: "inception",
        accountName: accountName?.length ? accountName : `inception-${timestamp}`,
        apiKey: formData.get("newKey") as string,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): InceptionConnection[] {
    if (!this.isInceptionCredential(credential)) throw new Error("Invalid credential type");

    return InceptionProvider.defaultModels.map(
      (model) =>
        ({
          id: `${model}:${credential.id}`,
          type: "inception",
          displayGroup: credential.accountName,
          displayName: model === "mercury" ? "Mercury" : "Mercury Coder",
          model,
          apiKey: credential.apiKey,
        }) satisfies InceptionConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isInceptionCredential(credential)) throw new Error("Invalid credential type");

    return {
      title: credential.accountName,
      tagLine: credential.type,
      features: InceptionProvider.defaultModels.join(","),
    };
  }

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isInceptionConnection(connection)) throw new Error("Invalid connection type");

    return {
      temperature: { min: 0.5, max: 1.0 },
      maxTokens: { min: 1, max: 16384 },
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isInceptionConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const apiUrl = "https://api.inceptionlabs.ai/v1/chat/completions";

      const options = that.getOptions(connection);

      // Clamp temperature to the allowed range (0.5-1.0)
      const resolvedTemperature =
        config?.temperature !== undefined && options.temperature
          ? that.clamp(config.temperature, options.temperature.min ?? 0.5, options.temperature.max)
          : undefined;

      // Clamp maxTokens to the allowed range (1-16384)
      const resolvedMaxTokens =
        config?.maxTokens !== undefined && options.maxTokens
          ? that.clamp(config.maxTokens, options.maxTokens.min ?? 1, options.maxTokens.max)
          : 1000;

      const requestBody: InceptionChatCompletionRequest = {
        model: connection.model,
        messages: that.getInceptionMessages(messages),
        max_tokens: resolvedMaxTokens,
        temperature: resolvedTemperature,
        top_p: config?.topP,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      };

      const start = performance.now();

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${connection.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Inception API error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "" || line.trim() === "data: [DONE]") {
              continue;
            }

            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6);
                const chunk: InceptionStreamChunk = JSON.parse(jsonStr);

                const content = chunk.choices?.[0]?.delta?.content;
                if (content) {
                  yield content;
                }

                if (chunk.usage?.completion_tokens) {
                  totalTokens = chunk.usage.completion_tokens;
                  config.onMetadata?.({
                    totalOutputTokens: totalTokens,
                    durationMs: performance.now() - start,
                  });
                }
              } catch (e) {
                console.warn("Failed to parse SSE chunk:", line, e);
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim() && buffer.startsWith("data: ")) {
          try {
            const jsonStr = buffer.slice(6);
            const chunk: InceptionStreamChunk = JSON.parse(jsonStr);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
            if (chunk.usage?.completion_tokens) {
              totalTokens = chunk.usage.completion_tokens;
              config?.onMetadata?.({
                totalOutputTokens: totalTokens,
                durationMs: performance.now() - start,
              });
            }
          } catch (e) {
            console.warn("Failed to parse final SSE chunk:", buffer, e);
          }
        }
      } finally {
        reader.releaseLock();
      }
    };
  }

  private getInceptionMessages(messages: GenericMessage[]): InceptionMessage[] {
    const convertedMessages = messages.map((message) => {
      switch (message.role) {
        case "user": {
          if (typeof message.content === "string") {
            return { role: message.role, content: message.content };
          }

          const contentParts: InceptionContentPart[] = message.content
            .map((part) => {
              if (part.type === "text/plain" && !part.name) {
                // unnamed message is the main body text
                return { type: "text", text: dataUrlToText(part.url) } as InceptionContentPart;
              } else if (part.type.startsWith("image/")) {
                return {
                  type: "image_url",
                  image_url: { url: part.url },
                } as InceptionContentPart;
              } else if (part.type === "application/pdf") {
                // Convert PDF to text representation since Inception API may not support it directly
                const maybeTextFile = tryDecodeDataUrlAsText(part.url);
                if (maybeTextFile) {
                  return {
                    type: "text",
                    text: `
\`\`\`${part.name ?? "unnamed"} type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
                    `.trim(),
                  } as InceptionContentPart;
                }
                return {
                  type: "text",
                  text: `[PDF Document: ${part.name ?? "unnamed"}]`,
                } as InceptionContentPart;
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
                  } as InceptionContentPart;
                }
                throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
              }
            })
            .filter((part) => part !== null);

          return { role: message.role, content: contentParts };
        }
        case "assistant": {
          if (typeof message.content === "string") {
            return { role: message.role, content: message.content };
          }
          if (message.content.length === 0) {
            return { role: message.role, content: "" };
          }
          if (message.content.length === 1 && message.content[0].type === "text/plain") {
            return { role: message.role, content: dataUrlToText(message.content[0].url) };
          }

          const contentParts: InceptionContentPart[] = message.content.map((part) => {
            if (part.type === "text/plain") {
              return {
                type: "text",
                text: dataUrlToText(part.url),
              } as InceptionContentPart;
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
                } as InceptionContentPart;
              }
              throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
            }
          });

          if (!contentParts.length) {
            console.warn(`Unable to format assistant message content`, message.content);
            return null;
          }

          return { role: message.role, content: contentParts };
        }
        case "system": {
          if (typeof message.content === "string") {
            return { role: message.role, content: message.content };
          } else {
            return {
              role: message.role,
              content: message.content
                .filter((part) => part.type === "text/plain")
                .map((part) => dataUrlToText(part.url))
                .join("\n"),
            };
          }
        }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessages.filter((m) => m !== null) as InceptionMessage[];
  }

  private isInceptionCredential(credential: BaseCredential): credential is InceptionCredential {
    return credential.type === "inception";
  }

  private isInceptionConnection(connection: BaseConnection): connection is InceptionConnection {
    return connection.type === "inception";
  }
}
