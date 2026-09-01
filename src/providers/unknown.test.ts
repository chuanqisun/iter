import { describe, expect, it, vi } from "vitest";
import type { BaseConnection, BaseCredential } from "./base";
import { UnknownProvider } from "./unknown";

describe("UnknownProvider", () => {
  it("logs unknown provider type upon creation", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new UnknownProvider("legacy-type");
    expect(provider).toBeInstanceOf(UnknownProvider);

    expect(logSpy).toHaveBeenCalledWith("Unknown provider type: legacy-type");
    logSpy.mockRestore();
  });

  it("returns empty array for parseNewCredentialForm and credentialToConnections", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new UnknownProvider("legacy-type");

    expect(provider.parseNewCredentialForm(new FormData())).toEqual([]);
    expect(
      provider.credentialToConnections({
        id: "cred-1",
        type: "legacy-type",
      } as BaseCredential),
    ).toEqual([]);

    logSpy.mockRestore();
  });

  it("returns summary for credential and empty options", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new UnknownProvider("aoai");

    const summary = provider.getCredentialSummary({
      id: "cred-aoai",
      type: "aoai",
    } as BaseCredential);
    expect(summary.title).toBe("cred-aoai");
    expect(summary.tagLine).toBe("aoai");
    expect(summary.features).toBe("Unknown or deprecated provider");

    expect(
      provider.getOptions({
        id: "conn-1",
        type: "aoai",
        displayGroup: "aoai",
        displayName: "aoai",
      } as BaseConnection),
    ).toEqual({});

    logSpy.mockRestore();
  });

  it("throws error when getChatStreamProxy is called and stream is iterated", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new UnknownProvider("aoai");
    const connection: BaseConnection = {
      id: "conn-aoai",
      type: "aoai",
      displayGroup: "aoai",
      displayName: "aoai",
    };

    const streamProxy = provider.getChatStreamProxy(connection);
    const generator = streamProxy({
      messages: [{ role: "user", content: "hello" }],
    });

    await expect(generator.next()).rejects.toThrowError(
      "Cannot run chat stream for unknown provider type: aoai (connection: conn-aoai)",
    );

    logSpy.mockRestore();
  });
});
