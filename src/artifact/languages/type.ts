export interface ArtifactSupport {
  onMatchLanguage: (lang: string) => boolean;
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
