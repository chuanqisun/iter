import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { renameAttachment, replaceAttachment, upsertAttachments } from "./attachment";
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

describe("upsertAttachments", () => {
  it("appends new attachments with unique names directly", () => {
    const existing: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "foo.txt", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "bar.txt", type: "text/plain", size: 3, url: "" },
    };

    const node = createUserNode([existing]);
    const result = upsertAttachments(newAttachment)(node);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments?.[0].file.name).toBe("foo.txt");
    expect(result.attachments?.[1].file.name).toBe("bar.txt");
  });

  it("appends numeric suffix when file name conflicts with existing attachments", () => {
    const existing: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "foo.txt", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment1: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "foo.txt", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment2: AttachmentEmbedded = {
      id: "a-3",
      type: "embedded",
      file: { name: "foo.txt", type: "text/plain", size: 3, url: "" },
    };

    const node = createUserNode([existing]);
    const result = upsertAttachments(newAttachment1, newAttachment2)(node);

    expect(result.attachments).toHaveLength(3);
    expect(result.attachments?.[0].file.name).toBe("foo.txt");
    expect(result.attachments?.[1].file.name).toBe("foo (1).txt");
    expect(result.attachments?.[2].file.name).toBe("foo (2).txt");
  });

  it("handles complex file extensions correctly", () => {
    const existing: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "archive.tar.gz", type: "application/gzip", size: 3, url: "" },
    };
    const newAttachment: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "archive.tar.gz", type: "application/gzip", size: 3, url: "" },
    };

    const node = createUserNode([existing]);
    const result = upsertAttachments(newAttachment)(node);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments?.[0].file.name).toBe("archive.tar.gz");
    expect(result.attachments?.[1].file.name).toBe("archive.tar (1).gz");
  });

  it("handles files without extensions correctly", () => {
    const existing: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "LICENSE", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "LICENSE", type: "text/plain", size: 3, url: "" },
    };

    const node = createUserNode([existing]);
    const result = upsertAttachments(newAttachment)(node);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments?.[0].file.name).toBe("LICENSE");
    expect(result.attachments?.[1].file.name).toBe("LICENSE (1)");
  });

  it("handles when pasted file already has a numeric suffix", () => {
    const existing: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "foo (1).txt", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "foo (1).txt", type: "text/plain", size: 3, url: "" },
    };

    const node = createUserNode([existing]);
    const result = upsertAttachments(newAttachment)(node);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments?.[0].file.name).toBe("foo (1).txt");
    expect(result.attachments?.[1].file.name).toBe("foo (2).txt");
  });

  it("handles when pasted file has a suffix and some are unclaimed in a gap", () => {
    const existing1: AttachmentEmbedded = {
      id: "a-1",
      type: "embedded",
      file: { name: "foo (1).txt", type: "text/plain", size: 3, url: "" },
    };
    const existing2: AttachmentEmbedded = {
      id: "a-2",
      type: "embedded",
      file: { name: "foo (3).txt", type: "text/plain", size: 3, url: "" },
    };
    const newAttachment: AttachmentEmbedded = {
      id: "a-3",
      type: "embedded",
      file: { name: "foo (1).txt", type: "text/plain", size: 3, url: "" },
    };

    const node = createUserNode([existing1, existing2]);
    const result = upsertAttachments(newAttachment)(node);

    expect(result.attachments).toHaveLength(3);
    expect(result.attachments?.[0].file.name).toBe("foo (1).txt");
    expect(result.attachments?.[1].file.name).toBe("foo (3).txt");
    expect(result.attachments?.[2].file.name).toBe("foo (2).txt");
  });
});
