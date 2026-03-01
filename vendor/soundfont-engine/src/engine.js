import { EventEmitter } from './events.js';
import { OxiSynthBackend } from './backends/oxisynth.js';
import { SpessaSynthBackend } from './backends/spessasynth.js';
import { RustySynthBackend } from './backends/rustysynth.js';
import { WavetablePianoBackend } from './backends/wavetable.js';

/** Backend name -> constructor mapping */
const BACKENDS = {
  oxisynth: OxiSynthBackend,
  spessasynth: SpessaSynthBackend,
  rustysynth: RustySynthBackend,
  wavetable: WavetablePianoBackend,
};

/**
 * SoundFontEngine - unified facade for soundfont-based MIDI synthesis.
 *
 * Wraps a single backend at a time behind a clean, consistent API
 * with event emission and lifecycle management.
 *
 * If no backend is specified, a built-in wavetable piano is used as the
 * default - ready to play immediately with no soundfont files required.
 *
 * @example
 * ```js
 * // Instant piano - no setup needed
 * const engine = new SoundFontEngine();
 * await engine.resume();
 * engine.noteOn(60, 0.8);
 *
 * // With a soundfont backend
 * const engine = new SoundFontEngine({ backend: 'oxisynth' });
 * await engine.loadSoundFont('/soundfonts/gm.sf2');
 * engine.noteOn(60, 0.8);
 * ```
 */
export class SoundFontEngine extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string|object} [options.backend] - Backend name ('oxisynth', 'spessasynth', 'rustysynth', 'wavetable') or a backend instance. Defaults to 'wavetable'.
   * @param {AudioContext} [options.audioContext] - Existing AudioContext to reuse
   * @param {string} [options.vendorPath] - Base path to vendor directory containing WASM files and libs
   */
  constructor({ backend, audioContext = null, vendorPath = '' } = {}) {
    super();
    this._backend = null;
    this._audioContext = audioContext;
    this._vendorPath = vendorPath;

    this._setBackend(backend ?? 'wavetable');
  }

  // --- Properties ---

  /** @returns {AudioContext} The active AudioContext */
  get audioContext() {
    return this._backend?.audioContext ?? this._audioContext;
  }

  /** @returns {boolean} Whether the engine has a loaded soundfont and is ready to play */
  get ready() {
    return this._backend?.ready ?? false;
  }

  /**
   * Backend capability flags.
   * @returns {{ sf3: boolean, controlChange: boolean, pitchBend: boolean }}
   */
  get capabilities() {
    return this._backend?.capabilities ?? { sf3: false, controlChange: false, pitchBend: false };
  }

  /** @returns {string|null} Path of the currently active soundfont */
  get activeSoundFont() {
    return this._backend?._activeFont ?? null;
  }

  // --- Lifecycle ---

  /**
   * Switch to a different backend. Disposes the current one.
   * You'll need to reload soundfonts after switching.
   * @param {string|object} backend - Backend name or instance
   */
  setBackend(backend) {
    if (this._backend) {
      this._backend.dispose();
    }
    this._setBackend(backend);
  }

  /**
   * Load a SoundFont file. Multiple loads stack (last loaded overrides matching presets).
   * @param {string} path - URL or path to .sf2 or .sf3 file
   */
  async loadSoundFont(path) {
    this._requireBackend();
    return this._backend.loadSoundFont(path);
  }

  /**
   * Load multiple SoundFonts in sequence. Later fonts override earlier ones.
   * @param {string[]} paths
   */
  async loadSoundFontStack(paths) {
    this._requireBackend();
    return this._backend.loadSoundFontStack(paths);
  }

  /** Resume the AudioContext (required after user gesture in browsers). */
  async resume() {
    this._requireBackend();
    return this._backend.resume();
  }

  /**
   * Dispose the engine and release all resources.
   * If the AudioContext was created internally, it will be closed.
   */
  dispose() {
    if (this._backend) {
      this._backend.dispose();
      this._backend = null;
    }
    this.removeAllListeners();
  }

  // --- Note control ---

  /**
   * Trigger a MIDI note on.
   * If the backend hasn't been initialized yet (e.g. wavetable), it is
   * initialized automatically on first noteOn.
   * @param {number} midi - MIDI note number (0-127)
   * @param {number} [velocity=0.7] - Velocity (0.0-1.0)
   * @param {number} [channel=0] - MIDI channel (0-15)
   */
  noteOn(midi, velocity = 0.7, channel = 0) {
    if (this._backend && !this._backend.ready) {
      // Auto-init on first note (wavetable backend is synchronous-ready after init)
      this._backend.init().then(() => this._backend.noteOn(midi, velocity, channel));
      return;
    }
    this._backend?.noteOn(midi, velocity, channel);
  }

  /**
   * Trigger a MIDI note off.
   * @param {number} midi - MIDI note number (0-127)
   * @param {number} [channel=0] - MIDI channel (0-15)
   */
  noteOff(midi, channel = 0) {
    this._backend?.noteOff(midi, channel);
  }

  /**
   * Change the instrument on a MIDI channel.
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} program - Program/instrument number (0-127)
   */
  programChange(channel, program) {
    this._backend?.programChange(channel, program);
  }

  /**
   * Send a MIDI control change message.
   * Common controllers: 64 = sustain pedal, 1 = modulation, 7 = volume, 10 = pan
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} controller - Controller number (0-127)
   * @param {number} value - Controller value (0-127)
   */
  controlChange(channel, controller, value) {
    this._backend?.controlChange(channel, controller, value);
  }

  /**
   * Send a pitch bend message.
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} value - Pitch bend value (0-16383, center = 8192)
   */
  pitchBend(channel, value) {
    this._backend?.pitchBend(channel, value);
  }

  /**
   * Stop all notes gracefully (with release envelopes).
   * @param {number} [channel] - Specific channel, or all channels if omitted
   */
  allNotesOff(channel) {
    this._backend?.allNotesOff(channel);
  }

  /**
   * Immediately silence all sound on all channels.
   */
  allSoundOff() {
    this._backend?.allSoundOff();
  }

  // --- Internal ---

  _setBackend(backend) {
    if (typeof backend === 'string') {
      const BackendClass = BACKENDS[backend];
      if (!BackendClass) {
        throw new Error(
          `Unknown backend '${backend}'. Available: ${Object.keys(BACKENDS).join(', ')}`
        );
      }
      this._backend = new BackendClass({
        audioContext: this._audioContext,
        vendorPath: this._vendorPath,
      });
    } else if (backend && typeof backend === 'object') {
      this._backend = backend;
    } else {
      throw new Error('backend must be a string name or a backend instance');
    }

    // Bubble backend events through the engine
    this._backend.on('loading', (detail) => this.emit('loading', detail));
    this._backend.on('loaded', (detail) => this.emit('loaded', detail));
    this._backend.on('error', (detail) => this.emit('error', detail));
  }

  _requireBackend() {
    if (!this._backend) {
      throw new Error('No backend configured. Pass { backend } in constructor or call setBackend()');
    }
  }
}
