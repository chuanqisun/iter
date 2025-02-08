import type { ChatCompletionContentPartImage, ChatCompletionMessageParam } from "openai/resources/index.mjs";
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
        apiVersion: "2024-10-01-preview",
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

      const stream = await client.chat.completions.create(
        {
          stream: true,
          messages: that.getOpenAIMessages(messages),
          model: connection.deployment,
          temperature: config?.temperature,
          max_tokens: config?.maxTokens,
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
          return {
            role: message.role, content: message.content.map(part => {
              if (part.type === "text/plain") {
                return { type: "text", content: this.decodeAsPlaintext(part.url) }
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
            })
          }
        }
        case "system":
          return { role: "system", content: message.content }
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
