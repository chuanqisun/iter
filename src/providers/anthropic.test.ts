import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropic";

const mockStream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    Anthropic: class MockAnthropic {
      messages = {
        stream: mockStream,
      };
    },
  };
});

describe("AnthropicProvider", () => {
  const provider = new AnthropicProvider();

  beforeEach(() => {
    mockStream.mockClear();
  });

  it("creates connections with default models", () => {
    const credential = {
      id: "cred-1",
      type: "anthropic" as const,
      accountName: "my-account",
      apiKey: "test-api-key",
    };
    const connections = provider.credentialToConnections(credential);
    expect(connections.map((c) => c.model)).toEqual(AnthropicProvider.defaultModels);
  });

  it("returns options for adaptive thinking models", () => {
    const connection = {
      id: "test:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "test-model",
      model: "claude-sonnet-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature).toBeUndefined();
    expect(options.thinkingBudget).toBeUndefined();
    expect(options.reasoningEffort).toEqual([...AnthropicProvider.adaptiveThinkingEfforts]);
  });

  it("returns options for claude-haiku-5-5", () => {
    const connection = {
      id: "test:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "test-model",
      model: "claude-haiku-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature).toBeUndefined();
    expect(options.thinkingBudget).toBeUndefined();
    expect(options.reasoningEffort).toEqual([...AnthropicProvider.adaptiveThinkingEfforts]);
  });

  it("calls messages.stream with output_config for adaptive thinking", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello from Claude" },
        };
      })();

      return Object.assign(asyncIterable, {
        finalMessage: async () => ({
          content: [{ type: "text", text: "Hello from Claude" }],
          usage: {
            output_tokens: 12,
            cache_read_input_tokens: 4,
          },
        }),
      });
    });

    const connection = {
      id: "test:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "test-model",
      model: "claude-sonnet-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const proxy = provider.getChatStreamProxy(connection);
    const chunks: string[] = [];
    let metadata: any;

    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Hi" }],
      reasoningEffort: "medium",
      onMetadata: (m) => {
        metadata = m;
      },
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello from Claude"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5-5",
        output_config: { effort: "medium" },
      }),
      expect.anything(),
    );
    expect(mockStream.mock.calls[0][0].thinking).toBeUndefined();
    expect(mockStream.mock.calls[0][0].temperature).toBeUndefined();
    expect(metadata).toMatchObject({
      cachedInputTokens: 4,
      totalOutputTokens: 12,
    });
  });

  it("omits output_config when reasoning effort is none", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "No thinking" },
        };
      })();

      return Object.assign(asyncIterable, {
        finalMessage: async () => ({
          content: [{ type: "text", text: "No thinking" }],
          usage: { output_tokens: 5 },
        }),
      });
    });

    const connection = {
      id: "test:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "test-model",
      model: "claude-sonnet-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const proxy = provider.getChatStreamProxy(connection);
    const chunks: string[] = [];

    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Test" }],
      reasoningEffort: "none",
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["No thinking"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5-5",
        output_config: undefined,
      }),
      expect.anything(),
    );
    expect(mockStream.mock.calls[0][0].thinking).toBeUndefined();
    expect(mockStream.mock.calls[0][0].temperature).toBeUndefined();
  });

  it("calls messages.stream with output_config for claude-haiku-5-5", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello from Haiku 5.5" },
        };
      })();

      return Object.assign(asyncIterable, {
        finalMessage: async () => ({
          content: [{ type: "text", text: "Hello from Haiku 5.5" }],
          usage: { output_tokens: 10 },
        }),
      });
    });

    const connection = {
      id: "test:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "test-model",
      model: "claude-haiku-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const proxy = provider.getChatStreamProxy(connection);
    const chunks: string[] = [];

    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Hi" }],
      reasoningEffort: "low",
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello from Haiku 5.5"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-5-5",
        output_config: { effort: "low" },
      }),
      expect.anything(),
    );
    const lastCall = mockStream.mock.calls.at(-1)![0];
    expect(lastCall.thinking).toBeUndefined();
    expect(lastCall.temperature).toBeUndefined();
  });
});
