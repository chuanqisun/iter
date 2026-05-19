const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export interface WebSpeechResult {
  previous: string;
  replace: string;
  isFinal?: boolean;
}

export class WebSpeechRecognitionNode extends EventTarget {
  // Prevent starting multiple sessions
  public isStarted = false;
  private recognition = SpeechRecognition && new SpeechRecognition();
  private interim = "";

  constructor() {
    super();
    this.recognition && (this.recognition.interimResults = true);
  }

  private initSession() {
    const recognition = this.recognition!;

    this.isStarted = true;
    recognition.continuous = true;
    recognition.lang = "en-US";

    console.log("[recognition] will start");
    recognition.onstart = () => {
      console.log("[recognition] session stated");
    };
    recognition.onresult = (e) => {
      const latestItem = [...e.results].at(-1);
      if (!latestItem) return;

      if (latestItem.isFinal) {
        this.dispatchEvent(
          new CustomEvent<WebSpeechResult>("result", {
            detail: {
              previous: this.interim,
              replace: latestItem[0].transcript,
              isFinal: true,
            },
          }),
        );

        this.interim = "";
      } else {
        const previous = this.interim;
        this.interim = latestItem[0].transcript;
        this.dispatchEvent(
          new CustomEvent<WebSpeechResult>("result", {
            detail: {
              previous,
              replace: this.interim,
            },
          }),
        );
      }
    };

    recognition.onerror = (e) => {
      console.error(`[recognition] sliently omit error`, e);
      this.isStarted = false;
      if (recognition.continuous) {
        this.initSession();
        this.start();
      }
    };

    recognition.onend = () => {
      this.isStarted = false;
      recognition.stop();
      console.log("[recognition] session ended");
      if (recognition.continuous) {
        this.initSession();
        recognition.start();
      }
    };
  }

  public start() {
    if (this.isStarted || !this.recognition) return false;
    this.initSession();
    this.recognition?.start();
    return true;
  }

  public stop() {
    this.recognition && (this.recognition.continuous = false);
    console.log(`[recognition] stop requested`);
    this.recognition?.stop();
  }

  public abort() {
    this.recognition && (this.recognition.continuous = false);
    this.recognition?.abort();
  }
}

export const speech = new WebSpeechRecognitionNode();
