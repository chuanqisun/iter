import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { renameAttachment, replaceAttachment } from "./attachment";
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

    const updatedNode = renameAttachment(originalAttachment.id, renamedAttachment)(createUserNode([originalAttachment]));

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

    const updatedNode = replaceAttachment(originalAttachment.id, renamedAttachment)(createUserNode([originalAttachment]));

    expect(updatedNode.attachments).toEqual([originalAttachment]);
  });
});
