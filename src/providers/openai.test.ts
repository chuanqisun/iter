import { describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "./openai";

const mockStream = vi.fn();

vi.mock("openai", () => {
  return {
    OpenAI: class MockOpenAI {
      responses = {
        stream: mockStream,
      };
    },
  };
});

describe("OpenAIProvider", () => {
  const provider = new OpenAIProvider();

  it("has defaultModels containing only the GPT-6 family (astra, sol, terra, luna)", () => {
    expect(OpenAIProvider.defaultModels).toEqual(["gpt-6-astra", "gpt-6-sol", "gpt-6-terra", "gpt-6-luna"]);
  });

  it("returns options for gpt-6-astra without 'none' reasoning effort", () => {
    const connection = {
      id: "gpt-6-astra:test-id",
      type: "openai" as const,
      displayGroup: "openai",
      displayName: "gpt-6-astra",
      model: "gpt-6-astra",
      apiKey: "test-key",
    };

    const options = provider.getOptions(connection);
    expect(options.reasoningEffort).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(options.reasoningEffort).not.toContain("none");
    expect(options.verbosity).toEqual(["low", "medium", "high"]);
    expect(options.serviceTier).toEqual(["auto", "fast", "flex"]);
  });

  it.each(["gpt-6-sol", "gpt-6-terra", "gpt-6-luna"])(
    "returns options for %s with 'none' reasoning effort supported",
    (model) => {
      const connection = {
        id: `${model}:test-id`,
        type: "openai" as const,
        displayGroup: "openai",
        displayName: model,
        model,
        apiKey: "test-key",
      };

      const options = provider.getOptions(connection);
      expect(options.reasoningEffort).toEqual(["none", "low", "medium", "high", "xhigh", "max"]);
      expect(options.reasoningEffort).toContain("none");
      expect(options.verbosity).toEqual(["low", "medium", "high"]);
      expect(options.serviceTier).toEqual(["auto", "fast", "flex"]);
    },
  );

  it("creates connections for all default GPT-6 models", () => {
    const credential = {
      id: "cred-openai-1",
      type: "openai" as const,
      accountName: "my-openai",
      apiKey: "sk-test",
    };

    const connections = provider.credentialToConnections(credential);
    expect(connections.map((c) => c.model)).toEqual(["gpt-6-astra", "gpt-6-sol", "gpt-6-terra", "gpt-6-luna"]);
  });

  it("calls responses.stream with correct arguments and yields output deltas", async () => {
    mockStream.mockImplementationOnce(() => {
      const asyncIterable = (async function* () {
        yield { type: "response.output_text.delta", delta: "Hello " };
        yield { type: "response.output_text.delta", delta: "world!" };
      })();

      return Object.assign(asyncIterable, {
        finalResponse: async () => ({
          output: [],
          usage: {
            output_tokens: 12,
            input_tokens_details: { cached_tokens: 4 },
          },
        }),
      });
    });

    const connection = {
      id: "gpt-6-sol:test-id",
      type: "openai" as const,
      displayGroup: "openai",
      displayName: "gpt-6-sol",
      model: "gpt-6-sol",
      apiKey: "test-key",
    };

    const proxy = provider.getChatStreamProxy(connection);
    const chunks: string[] = [];
    let metadata: any;

    for await (const chunk of proxy({
      messages: [{ role: "user", content: "Hello GPT-6" }],
      search: true,
      onMetadata: (m) => {
        metadata = m;
      },
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello ", "world!"]);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-6-sol",
        tools: [{ type: "web_search" }],
        input: [{ role: "user", content: "Hello GPT-6" }],
        prompt_cache_key: "iter",
      }),
      expect.anything(),
    );
    expect(metadata).toMatchObject({
      cachedInputTokens: 4,
      totalOutputTokens: 12,
    });
  });
});
