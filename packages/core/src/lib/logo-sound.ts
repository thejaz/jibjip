export const LOGO_HOLD_MS = 3_000;
export const CHICK_SOUND_URL = "/audio/chick.mp3";

/** One local sample and one voice; releasing exits the loop without cutting its tail. */
export class LogoSound {
  private context: AudioContext | null = null;
  private buffer: Promise<AudioBuffer> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private holding = false;
  private longHold = false;
  private disposed = false;
  private createContext: () => AudioContext | null;

  constructor(createContext: () => AudioContext | null = () =>
    typeof AudioContext === "undefined" ? null : new AudioContext()) {
    this.createContext = createContext;
  }

  // Call synchronously from a user gesture, before awaiting the hold timer or fetch.
  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      this.context ??= this.createContext();
      if (!this.context) return false;
      if (this.context.state !== "running") await this.context.resume();
      return !this.disposed && this.context.state === "running";
    } catch { return false; }
  }

  begin() {
    if (this.disposed || this.holding) return;
    this.holding = true;
    this.longHold = false;
    void this.unlock().then(() => this.playIfReady());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.longHold = true;
      this.playIfReady();
    }, LOGO_HOLD_MS);
  }

  end(): boolean {
    const wasLong = this.longHold;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.holding = false;
    this.longHold = false;
    if (this.source) this.source.loop = false;
    return wasLong;
  }

  private playIfReady() {
    const context = this.context;
    if (this.disposed || !this.holding || !this.longHold || context?.state !== "running") return;
    if (this.source) {
      this.source.loop = true;
      return;
    }
    // Short clicks never fetch/decode audio. A failed request can be retried next hold.
    if (!this.buffer) {
      this.buffer = fetch(CHICK_SOUND_URL, { credentials: "same-origin", referrerPolicy: "no-referrer" })
        .then(response => {
          if (!response.ok) throw new Error("Sound unavailable.");
          return response.arrayBuffer();
        })
        .then(bytes => context.decodeAudioData(bytes));
    }
    const pending = this.buffer;
    void pending.then(buffer => {
      if (this.disposed || !this.holding || !this.longHold || context.state !== "running" || this.source) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (this.source === source) this.source = null;
      };
      this.source = source;
      try { source.start(); }
      catch {
        source.disconnect();
        if (this.source === source) this.source = null;
      }
    }).catch(() => { if (this.buffer === pending) this.buffer = null; });
  }

  dispose() {
    this.end();
    this.disposed = true;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.buffer = null;
  }
}
