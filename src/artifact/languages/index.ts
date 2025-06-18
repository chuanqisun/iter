import { GenericArtifact } from "./generic";
import { MarkdownArtifact } from "./markdown";
import { MermaidArtifact } from "./mermaid";
import { ScriptArtifact } from "./script";
import type { ArtifactSupport } from "./type";
import { XmlArtifact } from "./xml";

export const supportedArtifacts: ArtifactSupport[] = [
  new ScriptArtifact(),
  new XmlArtifact(),
  new MermaidArtifact(),
  new MarkdownArtifact(),
  new GenericArtifact(),
];
