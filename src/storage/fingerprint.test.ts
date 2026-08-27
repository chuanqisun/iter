import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import type { Attachment, ChatNode } from "../chat-tree/tree-store";
import { computeNodeFingerprint, computeThreadFingerprints, getAttachmentToken } from "./fingerprint";

function createNode(role: "system" | "user" | "assistant", content: string, attachments?: Attachment[]): ChatNode {
  return {
    id: `node-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    attachments,
    metadata$: new BehaviorSubject({}),
  };
}

describe("fingerprint", () => {
  const sampleAttachment1: Attachment = {
    id: "att-1",
    type: "embedded",
    file: { name: "test.png", type: "image/png", url: "data:image/png;base64,123", size: 1024 },
  };

  const sampleAttachment2: Attachment = {
    id: "att-2",
    type: "embedded",
    file: { name: "notes.txt", type: "text/plain", url: "data:text/plain;base64,456", size: 256 },
  };

  describe("getAttachmentToken", () => {
    it("formats metadata token as name:size:type", () => {
      expect(getAttachmentToken(sampleAttachment1)).toBe("test.png:1024:image/png");
      expect(getAttachmentToken(sampleAttachment2)).toBe("notes.txt:256:text/plain");
    });
  });

  describe("computeNodeFingerprint", () => {
    it("produces a 16-character hex string", async () => {
      const fp = await computeNodeFingerprint("user", "Hello world");
      expect(fp).toHaveLength(16);
      expect(fp).toMatch(/^[0-9a-f]{16}$/);
    });

    it("is deterministic for identical inputs", async () => {
      const fp1 = await computeNodeFingerprint("user", "Hello");
      const fp2 = await computeNodeFingerprint("user", "Hello");
      expect(fp1).toBe(fp2);
    });

    it("produces different fingerprints for different roles or content", async () => {
      const fpUser = await computeNodeFingerprint("user", "Hello");
      const fpAssistant = await computeNodeFingerprint("assistant", "Hello");
      const fpDifferentContent = await computeNodeFingerprint("user", "Hello!");

      expect(fpUser).not.toBe(fpAssistant);
      expect(fpUser).not.toBe(fpDifferentContent);
    });

    it("guarantees order-insensitivity for attachments", async () => {
      const fp1 = await computeNodeFingerprint("user", "With attachments", [sampleAttachment1, sampleAttachment2]);
      const fp2 = await computeNodeFingerprint("user", "With attachments", [sampleAttachment2, sampleAttachment1]);

      expect(fp1).toBe(fp2);
    });

    it("treats empty attachments array the same as undefined attachments", async () => {
      const fp1 = await computeNodeFingerprint("user", "No attachments", []);
      const fp2 = await computeNodeFingerprint("user", "No attachments", undefined);

      expect(fp1).toBe(fp2);
    });
  });

  describe("computeThreadFingerprints", () => {
    it("computes fingerprints for each node sequentially", async () => {
      const nodes = [
        createNode("system", "System instruction"),
        createNode("user", "Hello"),
        createNode("assistant", "Hi there!"),
      ];

      const fps = await computeThreadFingerprints(nodes);
      expect(fps).toHaveLength(3);
      expect(fps[0]).toBe(await computeNodeFingerprint("system", "System instruction"));
      expect(fps[1]).toBe(await computeNodeFingerprint("user", "Hello"));
      expect(fps[2]).toBe(await computeNodeFingerprint("assistant", "Hi there!"));
    });
  });
});
