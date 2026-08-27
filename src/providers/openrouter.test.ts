import { describe, expect, it, vi } from "vitest";
import { OpenRouterProvider, type OpenRouterConnection } from "./openrouter";
import { DEFAULT_MIN_CODING_SCORE, sanitizeParamsFromOptions } from "./shared";

const mockSend = vi.fn().mockImplementation(async () => {
  return (async function* () {
    yield { type: "response.output_text.delta", delta: "hello" };
    yield {
      type: "response.completed",
      response: {
        output: [],
        usage: undefined,
      },
    };
  })();
});

vi.mock("@openrouter/sdk", () => {
  return {
    OpenRouter: class MockOpenRouter {
      responses = {
        send: mockSend,
      };
    },
  };
});

describe("OpenRouterProvider", () => {
  const provider = new OpenRouterProvider();
  const mockConnection: OpenRouterConnection = {
    id: "test-id",
    type: "openrouter",
    displayGroup: "test",
    displayName: "test-model",
    model: "anthropic/claude-3.5-sonnet",
    apiKey: "test-key",
  };

  it("returns reasoningEffort and sort options", () => {
    const options = provider.getOptions(mockConnection);
    expect(options.reasoningEffort).toEqual(["auto", "none", "minimal", "low", "medium", "high", "xhigh", "max"]);
    expect(options.sort).toEqual(["price", "throughput", "latency"]);
  });

  it("defaults provider sort to 'price' and accepts specified sort options", async () => {
    mockSend.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Default sort
    const stream1 = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream1) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.provider).toEqual({ sort: "price" });

    mockSend.mockClear();

    // Throughput sort
    const stream2 = proxy({
      messages: [{ role: "user", content: "hi" }],
      sort: "throughput",
    });
    for await (const _ of stream2) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.provider).toEqual({ sort: "throughput" });

    mockSend.mockClear();

    // Latency sort
    const stream3 = proxy({
      messages: [{ role: "user", content: "hi" }],
      sort: "latency",
    });
    for await (const _ of stream3) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.provider).toEqual({ sort: "latency" });
  });

  it("leaves out reasoning effort parameters when reasoningEffort is 'auto' or undefined", async () => {
    mockSend.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Test with reasoningEffort: "auto"
    const stream1 = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "auto",
    });
    for await (const _ of stream1) {
      // consume stream
    }

    const firstCallArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(firstCallArgs).not.toHaveProperty("reasoning");
    expect(firstCallArgs).not.toHaveProperty("reasoning_effort");

    mockSend.mockClear();

    // Test with reasoningEffort undefined
    const stream2 = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream2) {
      // consume stream
    }

    const secondCallArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(secondCallArgs).not.toHaveProperty("reasoning");
    expect(secondCallArgs).not.toHaveProperty("reasoning_effort");
  });

  it("includes reasoning object when reasoningEffort is specified and not 'auto'", async () => {
    mockSend.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    const stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      reasoningEffort: "high",
    });
    for await (const _ of stream) {
      // consume stream
    }

    const callArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(callArgs).toHaveProperty("reasoning", { effort: "high" });
    expect(callArgs).not.toHaveProperty("reasoning_effort");
  });

  it("passes search and fetch tools when requested", async () => {
    mockSend.mockClear();
    const proxy = provider.getChatStreamProxy(mockConnection);

    // Search only
    let stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
    });
    for await (const _ of stream) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.tools).toEqual([{ type: "openrouter:web_search" }]);

    mockSend.mockClear();

    // Fetch only
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.tools).toEqual([{ type: "openrouter:web_fetch" }]);

    mockSend.mockClear();

    // Both search and fetch
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
      fetch: true,
    });
    for await (const _ of stream) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.tools).toEqual([
      { type: "openrouter:web_search" },
      { type: "openrouter:web_fetch" },
    ]);

    mockSend.mockClear();

    // Neither
    stream = proxy({
      messages: [{ role: "user", content: "hi" }],
    });
    for await (const _ of stream) {
    }
    expect(mockSend.mock.calls[0][0].responsesRequest.tools).toBeUndefined();
  });

  it("extracts citations from response and yields formatted references", async () => {
    mockSend.mockImplementationOnce(async () => {
      return (async function* () {
        yield { type: "response.output_text.delta", delta: "Here is the answer." };
        yield {
          type: "response.completed",
          response: {
            output: [
              {
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: "Here is the answer.",
                    annotations: [
                      { type: "url_citation", url: "https://example.com/a", title: "Example A" },
                      {
                        type: "url_citation",
                        url_citation: { url: "https://example.com/b", title: "Example B" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      })();
    });

    const proxy = provider.getChatStreamProxy(mockConnection);
    const chunks: string[] = [];
    for await (const chunk of proxy({
      messages: [{ role: "user", content: "hi" }],
      search: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      "Here is the answer.",
      "\n\n## References\n\n1. [Example A](https://example.com/a)\n2. [Example B](https://example.com/b)",
    ]);
  });

  it("includes built-in models auto, free, pareto in credentialToConnections", () => {
    const cred = {
      id: "cred-1",
      type: "openrouter",
      accountName: "my-openrouter",
      models: "auto,free,pareto",
      apiKey: "sk-test",
    };
    const connections = provider.credentialToConnections(cred);
    expect(connections.map((c) => c.model)).toEqual(["auto", "free", "pareto"]);

    const credWithCustom = {
      ...cred,
      models: "custom/model-1",
    };
    const connectionsWithCustom = provider.credentialToConnections(credWithCustom);
    expect(connectionsWithCustom.map((c) => c.model)).toEqual(["auto", "free", "pareto", "custom/model-1"]);
  });

  it("returns cost option for auto model", () => {
    const autoConn = { ...mockConnection, model: "auto" };
    const options = provider.getOptions(autoConn);
    expect(options.costTier).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(options.reasoningEffort).toEqual(["auto", "none", "minimal", "low", "medium", "high", "xhigh", "max"]);
    expect(options.sort).toEqual(["price", "throughput", "latency"]);
  });

  it("returns sort and score options for pareto model", () => {
    const paretoConn = { ...mockConnection, model: "pareto" };
    const options = provider.getOptions(paretoConn);
    expect(options.sort).toEqual(["price", "throughput", "latency"]);
    expect(options.minCodingScore).toEqual({ min: 0, max: 1, step: 0.05 });
    expect(options.costTier).toBeUndefined();
  });

  it("sends openrouter/auto model and auto-router plugin for auto connection", async () => {
    mockSend.mockClear();
    const autoConn = { ...mockConnection, model: "auto" };
    const proxy = provider.getChatStreamProxy(autoConn);

    const stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      costTier: "high",
    });
    for await (const _ of stream) {
    }

    const callArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(callArgs.model).toBe("openrouter/auto");
    expect(callArgs.plugins).toEqual([{ id: "auto-router", cost_tier: "high" }]);
  });

  it("sends openrouter/pareto-code model and pareto-router plugin for pareto connection", async () => {
    mockSend.mockClear();
    const paretoConn = { ...mockConnection, model: "pareto" };
    const proxy = provider.getChatStreamProxy(paretoConn);

    const stream = proxy({
      messages: [{ role: "user", content: "write python code" }],
      minCodingScore: DEFAULT_MIN_CODING_SCORE,
    });
    for await (const _ of stream) {
    }

    const callArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(callArgs.model).toBe("openrouter/pareto-code");
    expect(callArgs.plugins).toEqual([{ id: "pareto-router", min_coding_score: DEFAULT_MIN_CODING_SCORE }]);
  });

  it("sanitizes parameters for auto and pareto models correctly", () => {
    const autoConn = { ...mockConnection, model: "auto" };
    const paretoConn = { ...mockConnection, model: "pareto" };

    const autoSanitized = sanitizeParamsFromOptions(provider.getOptions(autoConn), {
      costTier: "high",
      reasoningEffort: "low",
      minCodingScore: 0.9,
    });
    expect(autoSanitized.costTier).toBe("high");
    expect(autoSanitized.reasoningEffort).toBe("low");
    expect(autoSanitized.minCodingScore).toBeUndefined(); // minCodingScore not supported for auto

    const paretoSanitized = sanitizeParamsFromOptions(provider.getOptions(paretoConn), {
      costTier: "high",
      minCodingScore: 0.9,
    });
    expect(paretoSanitized.costTier).toBeUndefined(); // costTier not supported for pareto
    expect(paretoSanitized.minCodingScore).toBe(0.9);
  });

  it("sends openrouter/free model for free connection", async () => {
    mockSend.mockClear();
    const freeConn = { ...mockConnection, model: "free" };
    const proxy = provider.getChatStreamProxy(freeConn);

    const stream = proxy({
      messages: [{ role: "user", content: "hello" }],
    });
    for await (const _ of stream) {
    }

    const callArgs = mockSend.mock.calls[0][0].responsesRequest;
    expect(callArgs.model).toBe("openrouter/free");
  });

  it("passes chosen model from response to onMetadata for router models (auto, free, pareto)", async () => {
    for (const model of ["auto", "free", "pareto"]) {
      mockSend.mockImplementationOnce(async () => {
        return (async function* () {
          yield { type: "response.output_text.delta", delta: "hello" };
          yield {
            type: "response.completed",
            response: {
              model: "openai/gpt-4o",
              output: [],
              usage: {
                outputTokens: 42,
                inputTokensDetails: {
                  cachedTokens: 10,
                },
              },
            },
          };
        })();
      });

      const onMetadata = vi.fn();
      const conn: OpenRouterConnection = { ...mockConnection, model };
      const proxy = provider.getChatStreamProxy(conn);
      const stream = proxy({
        messages: [{ role: "user", content: "hi" }],
        onMetadata,
      });
      for await (const _ of stream) {
      }

      expect(onMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "openai/gpt-4o",
          totalOutputTokens: 42,
          cachedInputTokens: 10,
        }),
      );
    }
  });

  it("does not pass model to onMetadata for non-router models", async () => {
    mockSend.mockImplementationOnce(async () => {
      return (async function* () {
        yield { type: "response.output_text.delta", delta: "hello" };
        yield {
          type: "response.completed",
          response: {
            model: "openai/gpt-4o",
            output: [],
            usage: {
              outputTokens: 42,
              inputTokensDetails: {
                cachedTokens: 10,
              },
            },
          },
        };
      })();
    });

    const onMetadata = vi.fn();
    const proxy = provider.getChatStreamProxy(mockConnection);
    const stream = proxy({
      messages: [{ role: "user", content: "hi" }],
      onMetadata,
    });
    for await (const _ of stream) {
    }

    expect(onMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        model: undefined,
        totalOutputTokens: 42,
        cachedInputTokens: 10,
      }),
    );
  });
});
