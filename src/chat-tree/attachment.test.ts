import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { dataUrlToText } from "../storage/codec";
import {
  createEmbeddedTextAttachment,
  renameAttachment,
  renameAttachmentFile,
  replaceAttachment,
  upsertAttachments,
} from "./attachment";
import type { AttachmentEmbedded, AttachmentExternal, ChatNode } from "./tree-store";

function createUserNode(attachments: AttachmentEmbedded[]): ChatNode {
  return {
    id: "node-1",
    role: "user",
    content: "",
    attachments,
    metadata$: new BehaviorSubject({}),
  };
}

describe("createEmbeddedTextAttachment", () => {
  it("creates an embedded text attachment with UTF-8 content and byte size", () => {
    const attachment = createEmbeddedTextAttachment("hello 🌍");

    expect(attachment.type).toBe("embedded");
    expect(attachment.file.name).toBe("filename.txt");
    expect(attachment.file.type).toBe("text/plain");
    expect(attachment.file.size).toBe(new TextEncoder().encode("hello 🌍").byteLength);
    expect(dataUrlToText(attachment.file.url)).toBe("hello 🌍");
  });

  it("sanitizes a supplied filename", () => {
    const attachment = createEmbeddedTextAttachment("content", "notes / draft.md");

    expect(attachment.file.name).toBe("notes___draft.md");
  });

  it("participates in attachment name collision handling", () => {
    const existing = createEmbeddedTextAttachment("first", "filename.md");
    const inserted = createEmbeddedTextAttachment("second", "filename.md");

    const result = upsertAttachments(inserted)(createUserNode([existing]));

    expect(result.attachments?.[1].file.name).toBe("filename (1).md");
  });
});

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

describe("renameAttachmentFile", () => {
  it("renames an embedded attachment without changing its content", () => {
    const attachment = createEmbeddedTextAttachment("content", "before.txt");

    const renamedAttachment = renameAttachmentFile(attachment, "after.txt");

    expect(renamedAttachment).toEqual({
      ...attachment,
      file: { ...attachment.file, name: "after.txt" },
    });
    expect(attachment.file.name).toBe("before.txt");
  });

  it("renames an external attachment while preserving file metadata", () => {
    const attachment: AttachmentExternal = {
      id: "attachment-1",
      type: "external",
      file: new File(["content"], "before.txt", {
        type: "text/plain",
        lastModified: 123,
      }),
    };

    const renamedAttachment = renameAttachmentFile(attachment, "after.txt");

    expect(renamedAttachment.file.name).toBe("after.txt");
    expect(renamedAttachment.file.type).toBe(attachment.file.type);
    expect(renamedAttachment.file.lastModified).toBe(123);
    expect(renamedAttachment.file.size).toBe(attachment.file.size);
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
