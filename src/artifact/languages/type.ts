export interface ArtifactSupport {
  /** From md code block language to shiki highlight language */
  onResolveLanguage: (lang: string) => string | undefined;
  onCopy: ArtifactHandler;
  onRun?: ArtifactHandler;
  onSave?: ArtifactHandler;
}

export type ArtifactHandler = (context: ArtifactContext) => void;
export interface ArtifactContext {
  lang: string;
  code: string;
  trigger: HTMLElement;
}
