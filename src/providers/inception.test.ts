import { describe, expect, it } from "vitest";
import { InceptionProvider } from "./inception";

describe("InceptionProvider", () => {
  const provider = new InceptionProvider();

  it("defines defaultModels as mercury-2.5", () => {
    expect(InceptionProvider.defaultModels).toEqual(["mercury-2.5"]);
  });

  it("creates connection with Mercury 2.5 displayName", () => {
    const credential = {
      id: "test-cred-id",
      type: "inception" as const,
      accountName: "my-account",
      apiKey: "test-key",
    };

    const connections = provider.credentialToConnections(credential);
    expect(connections).toEqual([
      {
        id: "mercury-2.5:test-cred-id",
        type: "inception",
        displayGroup: "my-account",
        displayName: "Mercury 2.5",
        model: "mercury-2.5",
        apiKey: "test-key",
      },
    ]);
  });

  it("returns options with reasoningEffort, maxTokens, and temperature", () => {
    const connection = {
      id: "mercury-2.5:test-cred-id",
      type: "inception" as const,
      displayGroup: "my-account",
      displayName: "Mercury 2.5",
      model: "mercury-2.5",
      apiKey: "test-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature).toEqual({ min: 0.5, max: 1.0 });
    expect(options.maxTokens).toEqual({ min: 1, max: 65536 });
    expect(options.reasoningEffort).toEqual(["instant", "low", "medium", "high"]);
  });
});
