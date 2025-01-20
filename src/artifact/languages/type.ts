export interface ArtifactSupport {
  /** From md code block language to shiki highlight language */
  onResolveLanguage: (lang: string) => string | undefined;
  onEdit: ArtifactHandler;
  onEditExit: ArtifactHandler;
  onCopy: ArtifactHandler;
  onRun?: ArtifactHandler;
  onRunExit?: ArtifactHandler;
  onSave: ArtifactHandler;
}

export type ArtifactHandler = (context: ArtifactContext) => any;
export interface ArtifactContext {
  lang: string;
  code: string;
  trigger: HTMLElement;
}
