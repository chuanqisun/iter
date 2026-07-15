import type {
	ChatCompletionAssistantMessageParam,
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

export interface CerebrasCredential extends BaseCredential {
	id: string;
	type: "cerebras";
	accountName: string;
	apiKey: string;
}

export interface CerebrasConnection extends BaseConnection {
	id: string;
	type: "cerebras";
	displayGroup: string;
	displayName: string;
	model: string;
	apiKey: string;
}

export class CerebrasProvider implements BaseProvider {
	static type = "cerebras";
	static defaultModels = ["gpt-oss-120b", "gemma-4-31b", "zai-glm-4.7"];

	parseNewCredentialForm(formData: FormData): CerebrasCredential[] {
		const accountName = formData.get("newAccountName") as string;

		/* YYYYMMDDHHMMSS */
		const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");

		return [
			{
				id: crypto.randomUUID(),
				type: "cerebras",
				accountName: accountName?.length ? accountName : `cerebras-${timestamp}`,
				apiKey: formData.get("newKey") as string,
			},
		];
	}

	credentialToConnections(credential: BaseCredential): CerebrasConnection[] {
		if (!this.isCerebrasCredential(credential)) throw new Error("Invalid credential type");

		return CerebrasProvider.defaultModels.map(
			(model) =>
				({
					id: `${model}:${credential.id}`,
					type: "cerebras",
					displayGroup: credential.accountName,
					displayName: model,
					model,
					apiKey: credential.apiKey,
				}) satisfies CerebrasConnection,
		);
	}

	getCredentialSummary(credential: BaseCredential) {
		if (!this.isCerebrasCredential(credential)) throw new Error("Invalid credential type");

		return {
			title: credential.accountName,
			tagLine: credential.type,
			features: CerebrasProvider.defaultModels.join(","),
		};
	}

	getOptions(connection: BaseConnection): GenericOptions {
		if (!this.isCerebrasConnection(connection)) throw new Error("Invalid connection type");

		const reasoningEffort =
			connection.model === "gpt-oss-120b"
				? ["medium", "low", "high"]
				: connection.model === "gemma-4-31b"
					? ["none", "low", "medium", "high"]
					: connection.model === "zai-glm-4.7"
						? ["default", "none"]
						: undefined;

		return {
			temperature: { max: 2 },
			reasoningEffort,
		};
	}

	getChatStreamProxy(connection: BaseConnection): ChatStreamProxy {
		if (!this.isCerebrasConnection(connection)) throw new Error("Invalid connection type");
		const that = this;

		return async function* ({ messages, abortSignal, ...config }: GenericChatParams) {
			const OpenAI = await import("openai").then((res) => res.OpenAI);
			const client = new OpenAI({
				apiKey: connection.apiKey,
				baseURL: "https://api.cerebras.ai/v1",
				dangerouslyAllowBrowser: true,
			});

			const options = that.getOptions(connection);
			const configuredReasoningEffort = config.reasoningEffort ?? options.reasoningEffort?.at(0);
			const reasoningEffort = configuredReasoningEffort === "default" ? undefined : configuredReasoningEffort;

			const start = performance.now();
			let latencyMs: number | undefined;
			const stream = await client.chat.completions.create(
				{
					stream: true,
					stream_options: {
						include_usage: true,
					},
					messages: that.getCerebrasMessages(messages),
					model: connection.model,
					temperature: options.temperature !== undefined ? config.temperature : undefined,
					reasoning_effort: reasoningEffort as ReasoningEffort | undefined,
					max_completion_tokens: config.maxTokens,
					top_p: config.topP,
					user: "iter",
				},
				{
					signal: abortSignal,
				},
			);

			for await (const chunk of stream) {
				const content = chunk.choices.at(0)?.delta?.content;
				if (content) {
					latencyMs ??= performance.now() - start;
					yield content;
				}
				if (chunk.usage) {
					config.onMetadata?.({
						cachedInputTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
						totalOutputTokens: chunk.usage.completion_tokens,
						latencyMs,
						durationMs: performance.now() - start,
					});
				}
			}
		};
	}

	private getCerebrasMessages(messages: GenericMessage[]): ChatCompletionMessageParam[] {
		const convertedMessages = messages.map((message) => {
			switch (message.role) {
				case "user": {
					if (typeof message.content === "string") return { role: message.role, content: message.content };

					return {
						role: message.role,
						content: message.content.map((part) => {
							if (part.type === "text/plain" && !part.name) {
								return { type: "text", text: dataUrlToText(part.url) } satisfies ChatCompletionContentPartText;
							}
							if (part.type.startsWith("image/")) {
								return {
									type: "image_url",
									image_url: { url: part.url },
								} satisfies ChatCompletionContentPartImage;
							}

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
						}),
					} satisfies ChatCompletionUserMessageParam;
				}
				case "assistant": {
					if (typeof message.content === "string") return { role: message.role, content: message.content };
					if (message.content.length === 0) return { role: message.role, content: "" };
					if (message.content.length === 1 && message.content[0].type === "text/plain") {
						return { role: message.role, content: dataUrlToText(message.content[0].url) };
					}

					const coercedOutputTexts = message.content.map((part) => {
						if (part.type === "text/plain") {
							return {
								type: "text",
								text: dataUrlToText(part.url),
							} as ChatCompletionContentPartText;
						}

						const maybeTextFile = tryDecodeDataUrlAsText(part.url);
						if (maybeTextFile) {
							return {
								type: "text",
								text: `
\`\`\`${part.name ?? "unnamed"} output type=${maybeTextFile.mediaType}
${maybeTextFile.text}
\`\`\`
								`.trim(),
							} as ChatCompletionContentPartText;
						}
						throw new Error(`Unsupported embedded message attachment: ${part.name ?? "unnamed"} ${part.type}`);
					});

					return {
						role: message.role,
						content: coercedOutputTexts as any[],
					} satisfies ChatCompletionAssistantMessageParam;
				}
				case "system": {
					const content =
						typeof message.content === "string"
							? message.content
							: message.content
									.filter((part) => part.type === "text/plain")
									.map((part) => dataUrlToText(part.url))
									.join("\n");
					return { role: message.role, content } satisfies ChatCompletionSystemMessageParam;
				}
				default: {
					console.warn("Unknown message type", message);
					return null;
				}
			}
		});

		return convertedMessages.filter((message) => message !== null);
	}

	private isCerebrasCredential(credential: BaseCredential): credential is CerebrasCredential {
		return credential.type === "cerebras";
	}

	private isCerebrasConnection(connection: BaseConnection): connection is CerebrasConnection {
		return connection.type === "cerebras";
	}
}
