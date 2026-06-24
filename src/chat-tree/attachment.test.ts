import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { getUniqueFilename, renameAttachment, replaceAttachment } from "./attachment";
import type { AttachmentEmbedded, ChatNode } from "./tree-store";

function createUserNode(attachments: AttachmentEmbedded[]): ChatNode {
  return {
    id: "node-1",
    role: "user",
    content: "",
    attachments,
    metadata$: new BehaviorSubject({}),
  };
}

describe("renameAttachment", () => {
  it("replaces an attachment by id even when the file name changes", () => {
    const originalAttachment: AttachmentEmbedded = {
      id: "attachment-1",
      type: "embedded",
      file: {
        name: "before.txt",
        type: "text/plain",
        size: 6,
        url: "data:text/plain;base64,YmVmb3Jl",
      },
    };
    const renamedAttachment: AttachmentEmbedded = {
      ...originalAttachment,
      file: {
        ...originalAttachment.file,
        name: "after.txt",
      },
    };

    const updatedNode = renameAttachment(
      originalAttachment.id,
      renamedAttachment,
    )(createUserNode([originalAttachment]));

    expect(updatedNode.attachments).toEqual([renamedAttachment]);
  });

  it("shows why replaceAttachment cannot be used for renaming", () => {
    const originalAttachment: AttachmentEmbedded = {
      id: "attachment-1",
      type: "embedded",
      file: {
        name: "before.txt",
        type: "text/plain",
        size: 6,
        url: "data:text/plain;base64,YmVmb3Jl",
      },
    };
    const renamedAttachment: AttachmentEmbedded = {
      ...originalAttachment,
      file: {
        ...originalAttachment.file,
        name: "after.txt",
      },
    };

    const updatedNode = replaceAttachment(
      originalAttachment.id,
      renamedAttachment,
    )(createUserNode([originalAttachment]));

    expect(updatedNode.attachments).toEqual([originalAttachment]);
  });
});

describe("getUniqueFilename", () => {
  it("returns the original name if there are no duplicates", () => {
    expect(getUniqueFilename("pasted.txt", new Set())).toBe("pasted.txt");
    expect(getUniqueFilename("pasted.txt", new Set(["other.txt"]))).toBe("pasted.txt");
  });

  it("appends a numeric suffix if name is already in the set", () => {
    expect(getUniqueFilename("pasted.txt", new Set(["pasted.txt"]))).toBe("pasted (1).txt");
    expect(getUniqueFilename("pasted.txt", new Set(["pasted.txt", "pasted (1).txt"]))).toBe("pasted (2).txt");
  });

  it("handles filenames without extensions", () => {
    expect(getUniqueFilename("pasted", new Set(["pasted"]))).toBe("pasted (1)");
    expect(getUniqueFilename("pasted", new Set(["pasted", "pasted (1)"]))).toBe("pasted (2)");
  });

  it("increments already-suffixed filenames correctly", () => {
    expect(getUniqueFilename("pasted (1).txt", new Set(["pasted (1).txt"]))).toBe("pasted (2).txt");
    expect(getUniqueFilename("pasted (1).txt", new Set(["pasted (1).txt", "pasted (2).txt"]))).toBe("pasted (3).txt");
  });
});
