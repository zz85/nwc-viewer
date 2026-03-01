// Type declarations for soundfont-engine

// ---- Data types ----

export interface NoteEvent {
  /** MIDI note number (0-127) */
  midi: number;
  /** Start time in seconds */
  time: number;
  /** Duration in seconds */
  duration: number;
  /** Velocity (0.0-1.0) */
  velocity: number;
  /** MIDI channel (0-15) */
  channel: number;
  /** Optional: track number from MIDI file */
  trackNo?: number;
}

export interface ControlChangeEvent {
  /** Time in seconds */
  time: number;
  /** MIDI channel (0-15) */
  channel: number;
  /** Controller number (0-127) */
  controller: number;
  /** Controller value (0-127) */
  value: number;
}

export interface BackendCapabilities {
  /** Whether SF3 soundfonts are supported natively (without conversion) */
  sf3: boolean;
  /** Whether MIDI control change messages are supported */
  controlChange: boolean;
  /** Whether pitch bend is supported */
  pitchBend: boolean;
}

export interface BackendOptions {
  /** Existing AudioContext to reuse instead of creating a new one */
  audioContext?: AudioContext;
  /** Base path to the vendor directory containing WASM files and libraries */
  vendorPath?: string;
}

export interface EngineOptions extends BackendOptions {
  /**
   * Backend to use. Either a string name ('oxisynth', 'spessasynth', 'rustysynth', 'wavetable')
   * or a pre-created backend instance. Defaults to 'wavetable' (built-in piano, no setup needed).
   */
  backend?: BackendName | BaseBackend;
}

export interface SchedulerOptions {
  /** Path to the scheduler-worklet.js file. Auto-resolved from import.meta.url if omitted. */
  workletPath?: string;
}

export interface SchedulerLoadData {
  /** Notes to schedule, sorted by time */
  notes: NoteEvent[];
  /** Control change events to schedule, sorted by time */
  controlChanges?: ControlChangeEvent[];
}

export type BackendName = 'oxisynth' | 'spessasynth' | 'rustysynth' | 'wavetable';

// ---- Engine events ----

export interface EngineEventMap {
  loading: { path: string };
  loaded: { path: string };
  error: { path: string; error: Error };
}

// ---- Scheduler events ----

export interface SchedulerEventMap {
  noteOn: NoteEvent;
  noteOff: NoteEvent;
  cc: ControlChangeEvent;
  time: number;
  end: void;
}

// ---- EventEmitter ----

export declare class EventEmitter {
  on(event: string, fn: (...args: any[]) => void): this;
  off(event: string, fn: (...args: any[]) => void): this;
  once(event: string, fn: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): void;
  removeAllListeners(event?: string): void;
}

// ---- BaseBackend ----

export declare class BaseBackend extends EventEmitter {
  constructor(options?: BackendOptions);

  /** The active AudioContext (created lazily if not provided externally) */
  readonly audioContext: AudioContext;
  /** Whether a soundfont is loaded and the backend is ready to play */
  readonly ready: boolean;
  /** Capability flags for this backend */
  readonly capabilities: BackendCapabilities;

  init(): Promise<void>;
  loadSoundFont(path: string): Promise<void>;
  loadSoundFontStack(paths: string[]): Promise<void>;
  noteOn(midi: number, velocity?: number, channel?: number): void;
  noteOff(midi: number, channel?: number): void;
  programChange(channel: number, program: number): void;
  controlChange(channel: number, controller: number, value: number): void;
  pitchBend(channel: number, value: number): void;
  allNotesOff(channel?: number): void;
  allSoundOff(): void;
  resume(): Promise<void>;
  dispose(): void;

  // Events
  on(event: 'loading', fn: (detail: { path: string }) => void): this;
  on(event: 'loaded', fn: (detail: { path: string }) => void): this;
  on(event: 'error', fn: (detail: { path: string; error: Error }) => void): this;
  on(event: string, fn: (...args: any[]) => void): this;
}

// ---- Backends ----

/**
 * OxiSynth backend - Rust-based SoundFont2 synthesizer (WASM).
 * SF2 native, SF3 auto-converted via spessasynth_core.
 * Full MIDI support: controlChange, pitchBend, allNotesOff, allSoundOff.
 */
export declare class OxiSynthBackend extends BaseBackend {
  constructor(options?: BackendOptions);
}

/**
 * SpessaSynth backend - JavaScript SoundFont synthesizer with AudioWorklet rendering.
 * SF2 and SF3 native support (no conversion needed).
 * Full MIDI support: controlChange, pitchBend, allNotesOff, allSoundOff.
 */
export declare class SpessaSynthBackend extends BaseBackend {
  constructor(options?: BackendOptions);
}

/**
 * RustySynth backend - Rust-based SoundFont2 synthesizer (WASM).
 * SF2 only, SF3 auto-converted via spessasynth_core.
 * Limited MIDI support: no controlChange, pitchBend, allNotesOff, or allSoundOff.
 */
export declare class RustySynthBackend extends BaseBackend {
  constructor(options?: BackendOptions);
}

/**
 * WavetablePiano backend - built-in piano using PeriodicWave synthesis.
 * Zero dependencies, no WASM, no soundfont files needed.
 * Ready to play immediately after init(). Piano timbre only.
 * No controlChange or pitchBend support. programChange is a no-op.
 */
export declare class WavetablePianoBackend extends BaseBackend {
  constructor(options?: BackendOptions);
}

// ---- SoundFontEngine ----

/**
 * Unified facade for soundfont-based MIDI synthesis.
 *
 * Defaults to a built-in wavetable piano if no backend is specified -
 * ready to play immediately with zero setup.
 *
 * @example
 * ```ts
 * // Instant piano - no config needed
 * const engine = new SoundFontEngine();
 * engine.noteOn(60, 0.8);
 *
 * // With a soundfont backend
 * const engine = new SoundFontEngine({
 *   backend: 'oxisynth',
 *   vendorPath: '/vendor',
 * });
 * await engine.loadSoundFont('/soundfonts/gm.sf2');
 * engine.noteOn(60, 0.8);
 * ```
 */
export declare class SoundFontEngine extends EventEmitter {
  constructor(options?: EngineOptions);

  /** The active AudioContext */
  readonly audioContext: AudioContext;
  /** Whether the engine is ready to play */
  readonly ready: boolean;
  /** Backend capability flags */
  readonly capabilities: BackendCapabilities;
  /** Path of the currently active soundfont */
  readonly activeSoundFont: string | null;

  /**
   * Switch to a different backend. Disposes the current one.
   * Soundfonts must be reloaded after switching.
   */
  setBackend(backend: BackendName | BaseBackend): void;

  /** Load a SoundFont file (.sf2 or .sf3) */
  loadSoundFont(path: string): Promise<void>;
  /** Load multiple SoundFonts in sequence (later overrides earlier) */
  loadSoundFontStack(paths: string[]): Promise<void>;
  /** Resume AudioContext (required after user gesture) */
  resume(): Promise<void>;
  /** Dispose engine and release all resources */
  dispose(): void;

  /**
   * Trigger a MIDI note on.
   * @param midi - MIDI note number (0-127)
   * @param velocity - Velocity (0.0-1.0), default 0.7
   * @param channel - MIDI channel (0-15), default 0
   */
  noteOn(midi: number, velocity?: number, channel?: number): void;
  /** Trigger a MIDI note off */
  noteOff(midi: number, channel?: number): void;
  /** Change instrument on a channel */
  programChange(channel: number, program: number): void;
  /** Send a MIDI control change (e.g. sustain pedal = CC 64) */
  controlChange(channel: number, controller: number, value: number): void;
  /** Send a pitch bend message (0-16383, center = 8192) */
  pitchBend(channel: number, value: number): void;
  /** Stop all notes gracefully */
  allNotesOff(channel?: number): void;
  /** Immediately silence everything */
  allSoundOff(): void;

  // Events
  on(event: 'loading', fn: (detail: { path: string }) => void): this;
  on(event: 'loaded', fn: (detail: { path: string }) => void): this;
  on(event: 'error', fn: (detail: { path: string; error: Error }) => void): this;
  on(event: string, fn: (...args: any[]) => void): this;
}

// ---- MidiScheduler ----

/**
 * AudioWorklet-based MIDI event scheduler.
 * Survives browser background tabs with sample-accurate timing.
 *
 * @example
 * ```ts
 * const scheduler = new MidiScheduler(engine);
 * await scheduler.init();
 * scheduler.load({ notes, controlChanges });
 * scheduler.on('noteOn', (note) => highlightKey(note.midi));
 * scheduler.play();
 * ```
 */
export declare class MidiScheduler extends EventEmitter {
  constructor(target: SoundFontEngine | BaseBackend, options?: SchedulerOptions);

  /** Whether the worklet is initialized */
  readonly ready: boolean;
  /** Whether playback is active */
  readonly playing: boolean;
  /** Current playback position in seconds */
  readonly currentTime: number;
  /** Total duration of loaded data in seconds */
  readonly duration: number;
  /** Playback speed multiplier (read/write) */
  speed: number;

  /** Initialize the AudioWorklet processor. Call before play(). */
  init(): Promise<void>;
  /** Load note and CC data for playback. Notes must be sorted by time. */
  load(data: SchedulerLoadData): void;
  /** Start or resume playback */
  play(): void;
  /** Pause playback (retains position) */
  pause(): void;
  /** Stop and reset to beginning */
  stop(): void;
  /** Seek to a position in seconds */
  seek(time: number): void;
  /** Set playback speed multiplier */
  setSpeed(speed: number): void;
  /** Dispose scheduler and disconnect worklet */
  dispose(): void;

  // Events
  on(event: 'noteOn', fn: (note: NoteEvent) => void): this;
  on(event: 'noteOff', fn: (note: NoteEvent) => void): this;
  on(event: 'cc', fn: (cc: ControlChangeEvent) => void): this;
  on(event: 'time', fn: (time: number) => void): this;
  on(event: 'end', fn: () => void): this;
  on(event: string, fn: (...args: any[]) => void): this;
}
