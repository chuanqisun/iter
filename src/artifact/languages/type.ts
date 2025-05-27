export interface ArtifactSupport {
  /** From md code block language to shiki highlight language */
  onResolveLanguage: (lang: string) => string | undefined;
  onRun?: ArtifactHandler;
  onSave: ArtifactHandler;
  onAttach: ArtifactHandler;
}

export type ArtifactHandler = (context: ArtifactContext) => any;
export interface ArtifactContext {
  lang: string;
  code: string;
  filename?: string;
  trigger: HTMLElement;
  preview?: HTMLElement;
  nodeId?: string;
}
