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

export interface AzureOpenAICredential extends BaseCredential {
  id: string;
  type: "aoai";
  endpoint: string;
  deployments: string;
  apiKey: string;
}

export interface AzureOpenAIConnection extends BaseConnection {
  id: string;
  type: "aoai";
  displayGroup: string;
  displayName: string;
  endpoint: string;
  deployment: string;
  apiKey: string;
  apiVersion: string;
}

export class AzureOpenAIProvider implements BaseProvider {
  static type = "aoai";
  static defaultModels = ["o4-mini", "gpt-4o"];

  parseNewCredentialForm(formData: FormData): AzureOpenAICredential[] {
    const endpoint = this.ensureTrailingSlash(formData.get("newEndpoint") as string);
    const apiKey = formData.get("newKey") as string;
    let deployments = (formData.get("newDeployments") as string)
      .split(",")
      .map((deployment) => deployment.trim())
      .join(",");

    if (!deployments.length) {
      deployments = AzureOpenAIProvider.defaultModels.join(",");
    }

    return [
      {
        id: crypto.randomUUID(),
        type: "aoai",
        endpoint,
        deployments,
        apiKey,
      },
    ];
  }

  credentialToConnections(credential: BaseCredential): AzureOpenAIConnection[] {
    if (!this.isAzureOpenAICredential(credential)) throw new Error("Invalid credential type");

    return credential.deployments.split(",").map(
      (deployment) =>
        ({
          id: `${deployment}:${credential.id}`,
          type: "aoai",
          displayGroup: new URL(credential.endpoint).hostname.split(".")[0],
          displayName: deployment,
          endpoint: credential.endpoint,
          deployment,
          apiKey: credential.apiKey,
          apiVersion: "2025-04-01-preview",
        }) satisfies AzureOpenAIConnection,
    );
  }

  getCredentialSummary(credential: BaseCredential) {
    if (!this.isAzureOpenAICredential(credential)) throw new Error("Invalid credential type");

    return {
      title: new URL(credential.endpoint).hostname,
      tagLine: credential.type,
      features: credential.deployments,
    };
  }

  getOptions(connection: BaseConnection): GenericOptions {
    if (!this.isAzureOpenAIConnection(connection)) throw new Error("Invalid connection type");
    const model = connection.deployment;
    return getOpenAIOptions(model);
  }

  getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
    if (!this.isAzureOpenAIConnection(connection)) throw new Error("Invalid connection type");
    const that = this;

    return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
      const AzureOpenAI = await import("openai").then((res) => res.AzureOpenAI);
      const client = new AzureOpenAI({
        apiKey: connection.apiKey,
        endpoint: connection.endpoint,
        apiVersion: connection.apiVersion,
        deployment: connection.deployment,
        dangerouslyAllowBrowser: true,
      });

      const options = that.getOptions(connection);

      const isSystemMessageSupported = !connection.deployment.startsWith("o1-mini");

      const start = performance.now();
      const stream = client.responses.stream({
        input: that.getOpenAIMessages(messages, { isSystemMessageSupported }),
        model: connection.deployment,
        temperature: options.temperature !== undefined ? config?.temperature : undefined,
        ...(options.reasoningEffort
          ? { reasoning: { effort: (config.reasoningEffort ?? "medium") as ReasoningEffort } }
          : {}),
        text: {
          ...(options.verbosity ? { verbosity: config?.verbosity as "low" | "medium" | "high" } : {}),
        },
        max_output_tokens: config?.maxTokens,
        top_p: config?.topP,
        user: "iter", // HACK: this seems to significantly improve cache hit rate
      });

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

  private isAzureOpenAICredential(credential: BaseCredential): credential is AzureOpenAICredential {
    return credential.type === "aoai";
  }

  private isAzureOpenAIConnection(connection: BaseConnection): connection is AzureOpenAIConnection {
    return connection.type === "aoai";
  }

  private ensureTrailingSlash(url: string) {
    return url.endsWith("/") ? url : url + "/";
  }
}
