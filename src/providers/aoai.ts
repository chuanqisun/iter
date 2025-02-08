import type { ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/index.mjs";
import type { BaseConnection, BaseCredential, BaseProvider, ChatStreamProxy, GenericChatParams, GenericMessage } from "./base";

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
  static defaultModels = ["gpt-4o", "gpt-4o-mini"];

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
        apiVersion: "2025-01-01-preview",
      } satisfies AzureOpenAIConnection)
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

      const systemRoleName = connection.deployment.startsWith("o") ? "developer" : "system";
      const isTemperatureSupported = !connection.deployment.startsWith("o");

      const stream = await client.chat.completions.create(
        {
          stream: true,
          messages: that.getOpenAIMessages(messages, {
            systemRoleName
          }),
          model: connection.deployment,
          temperature: isTemperatureSupported ? config?.temperature : undefined,
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

  private getOpenAIMessages(messages: GenericMessage[], options: {
    systemRoleName: string;
  }): ChatCompletionMessageParam[] {
    const convertedMessage = messages.map((message) => {
      switch (message.role) {
        case "user":
        case "assistant": {
          if (typeof message.content === "string") return { role: message.role, content: message.content }

          return {
            role: message.role, content: message.content.map(part => {
              if (part.type === "text/plain") {
                return { type: "text", text: this.decodeAsPlaintext(part.url) } satisfies ChatCompletionContentPartText
              } else if (part.type.startsWith("image/")) {
                return {
                  type: "image_url",
                  image_url: {
                    url: part.url,
                  }
                } satisfies ChatCompletionContentPartImage
              } else {
                console.warn("Unsupported message part", part);
                return null;
              }
            }).filter(part => part !== null)
          }
        }
        case "system":

          if (typeof message.content === "string") {
            return { role: options.systemRoleName, content: message.content }
          } else {
            return { role: options.systemRoleName, content: message.content.filter(part => part.type === "text/plain").map(part => this.decodeAsPlaintext(part.url)).join("\n") }
          }
        default: {
          console.warn("Unknown message type", message);
          return null;
        }
      }
    });

    return convertedMessage.filter((m) => m !== null) as ChatCompletionMessageParam[];
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

  private decodeAsPlaintext(dataUrl: string) {
    return atob(dataUrl.split(",")[1]);
  }
}
