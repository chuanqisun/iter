import { describe, expect, it, vi } from "vitest";
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

  it("includes claude-opus-5-5 in defaultModels", () => {
    expect(AnthropicProvider.defaultModels).toContain("claude-opus-5-5");
    expect(AnthropicProvider.defaultModels).not.toContain("claude-opus-5");
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

  it("returns adaptive thinking options for claude-opus-5-5", () => {
    const connection = {
      id: "claude-opus-5-5:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "claude-opus-5-5",
      model: "claude-opus-5-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature).toBeUndefined();
    expect(options.thinkingBudget).toBeUndefined();
    expect(options.reasoningEffort).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });

  it("returns budget thinking and temperature options for haiku", () => {
    const connection = {
      id: "claude-haiku-4-5:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "claude-haiku-4-5",
      model: "claude-haiku-4-5",
      apiVersion: "2023-06-01",
      apiKey: "test-api-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature?.max).toBe(1);
    expect(options.thinkingBudget?.max).toBe(32000);
    expect(options.reasoningEffort).toBeUndefined();
  });

  it("calls messages.stream with output_config and without thinking field for claude-opus-5-5", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello from Opus 5.5" },
        };
      })();

      return Object.assign(asyncIterable, {
        finalMessage: async () => ({
          content: [{ type: "text", text: "Hello from Opus 5.5" }],
          usage: {
            output_tokens: 12,
            cache_read_input_tokens: 4,
          },
        }),
      });
    });

    const connection = {
      id: "claude-opus-5-5:cred-1",
      type: "anthropic" as const,
      displayGroup: "anthropic",
      displayName: "claude-opus-5-5",
      model: "claude-opus-5-5",
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

    expect(chunks).toEqual(["Hello from Opus 5.5"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5-5",
        thinking: undefined,
        output_config: { effort: "medium" },
      }),
      expect.anything(),
    );
    expect(metadata).toMatchObject({
      cachedInputTokens: 4,
      totalOutputTokens: 12,
    });
  });
});
