import { beforeEach, describe, expect, it } from "vitest";
import { deleteCredential, listCredentials, moveCredential, upsertCredentials } from "./connections-store";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  clear: () => storage.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("connections-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a new credential when account name does not exist", () => {
    const newCred = {
      id: "id-1",
      type: "openai",
      accountName: "personal",
      apiKey: "sk-test-1",
    };

    const result = upsertCredentials([newCred]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(newCred);
    expect(listCredentials()).toEqual([newCred]);
  });

  it("overrides existing credential when account name matches", () => {
    const cred1 = {
      id: "id-1",
      type: "openai",
      accountName: "personal",
      apiKey: "sk-old",
    };

    upsertCredentials([cred1]);

    const updatedCred = {
      id: "id-2",
      type: "openai",
      accountName: "personal",
      apiKey: "sk-new",
    };

    const result = upsertCredentials([updatedCred]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "id-1",
      type: "openai",
      accountName: "personal",
      apiKey: "sk-new",
    });
  });

  it("deletes a credential by id", () => {
    const cred1 = {
      id: "id-1",
      type: "openai",
      accountName: "personal",
      apiKey: "sk-1",
    };
    const cred2 = {
      id: "id-2",
      type: "openai",
      accountName: "work",
      apiKey: "sk-2",
    };

    upsertCredentials([cred1, cred2]);
    expect(listCredentials()).toHaveLength(2);

    const remaining = deleteCredential("id-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("id-2");
  });

  it("moves a credential up and down with wrap around", () => {
    const cred1 = { id: "id-1", type: "openai", accountName: "account-1", apiKey: "sk-1" };
    const cred2 = { id: "id-2", type: "openai", accountName: "account-2", apiKey: "sk-2" };
    const cred3 = { id: "id-3", type: "openai", accountName: "account-3", apiKey: "sk-3" };

    upsertCredentials([cred1, cred2, cred3]);

    const afterMoveUp = moveCredential("id-2", -1);
    expect(afterMoveUp.map((c) => c.id)).toEqual(["id-2", "id-1", "id-3"]);

    const afterMoveDown = moveCredential("id-2", 1);
    expect(afterMoveDown.map((c) => c.id)).toEqual(["id-1", "id-2", "id-3"]);

    // Test wrap around moving first item up -> moves to end
    const wrapUp = moveCredential("id-1", -1);
    expect(wrapUp.map((c) => c.id)).toEqual(["id-2", "id-3", "id-1"]);

    // Test wrap around moving last item down -> moves to top
    const wrapDown = moveCredential("id-1", 1);
    expect(wrapDown.map((c) => c.id)).toEqual(["id-1", "id-2", "id-3"]);
  });
});
