import { EventEmitter } from '../events.js';

/**
 * Base class for all soundfont synth backends.
 *
 * Provides:
 * - AudioContext management (accept external or create internal)
 * - Pending command queue (auto-flush when ready)
 * - Event emission (loading, loaded, error)
 *
 * Subclasses must implement:
 * - _doInit()           -> async, initialize WASM/engine
 * - _doLoadSoundFont()  -> async, load a soundfont buffer
 * - _doNoteOn()         -> send note on to engine
 * - _doNoteOff()        -> send note off to engine
 * - _doProgramChange()  -> send program change
 * - _doDispose()        -> cleanup
 *
 * Subclasses may override:
 * - _doControlChange()
 * - _doPitchBend()
 * - _doAllNotesOff()
 * - _doAllSoundOff()
 */
export class BaseBackend extends EventEmitter {
  constructor({ audioContext = null, vendorPath = '' } = {}) {
    super();
    this._externalCtx = audioContext;
    this._ctx = audioContext;
    this.vendorPath = vendorPath.replace(/\/$/, ''); // strip trailing slash
    this.ready = false;
    this._pending = [];
    this._fontIndex = new Map(); // path -> backend-specific font handle
    this._activeFont = null;
    this._initPromise = null;
  }

  /** @returns {AudioContext} */
  get audioContext() {
    if (!this._ctx) {
      this._ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    }
    return this._ctx;
  }

  /**
   * Capabilities of this backend. Override in subclasses.
   * @returns {{ sf3: boolean, controlChange: boolean, pitchBend: boolean }}
   */
  get capabilities() {
    return { sf3: false, controlChange: false, pitchBend: false };
  }

  // --- Public API (final - do not override) ---

  async init() {
    if (!this._initPromise) {
      this._initPromise = this._doInit();
    }
    return this._initPromise;
  }

  async loadSoundFont(path) {
    await this.init();

    if (this._activeFont === path) return;

    this.emit('loading', { path });

    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      let data = new Uint8Array(await response.arrayBuffer());

      // SF3 conversion if backend doesn't support it natively
      if (path.endsWith('.sf3') && !this.capabilities.sf3) {
        data = await this._convertSF3(data);
      }

      await this._doLoadSoundFont(path, data);

      this._activeFont = path;
      this.ready = true;

      this.emit('loaded', { path });
      this._flushPending();
    } catch (e) {
      this.emit('error', { path, error: e });
      console.error('[soundfont-engine] Failed to load soundfont:', e);
      throw e;
    }
  }

  async loadSoundFontStack(paths) {
    for (const path of paths) {
      await this.loadSoundFont(path);
    }
  }

  noteOn(midi, velocity = 0.7, channel = 0) {
    if (!this.ready) {
      this._pending.push(['noteOn', [midi, velocity, channel]]);
      return;
    }
    this._doNoteOn(midi, velocity, channel);
  }

  noteOff(midi, channel = 0) {
    if (!this.ready) {
      this._pending.push(['noteOff', [midi, channel]]);
      return;
    }
    this._doNoteOff(midi, channel);
  }

  programChange(channel, program) {
    if (!this.ready) {
      this._pending.push(['programChange', [channel, program]]);
      return;
    }
    this._doProgramChange(channel, program);
  }

  controlChange(channel, controller, value) {
    if (!this.ready) return;
    this._doControlChange(channel, controller, value);
  }

  pitchBend(channel, value) {
    if (!this.ready) return;
    this._doPitchBend(channel, value);
  }

  allNotesOff(channel) {
    if (!this.ready) return;
    this._doAllNotesOff(channel);
  }

  allSoundOff() {
    if (!this.ready) return;
    this._doAllSoundOff();
  }

  async resume() {
    return this.audioContext.resume();
  }

  dispose() {
    this.allSoundOff();
    this._doDispose();
    // Only close the AudioContext if we created it
    if (!this._externalCtx && this._ctx) {
      this._ctx.close();
    }
    this._ctx = null;
    this._pending = [];
    this.ready = false;
    this._initPromise = null;
    this._fontIndex.clear();
    this._activeFont = null;
    this.removeAllListeners();
  }

  // --- Internal helpers ---

  _flushPending() {
    const pending = this._pending;
    this._pending = [];
    for (const [method, args] of pending) {
      this[method](...args);
    }
  }

  async _convertSF3(sf3Data) {
    const { SoundBankLoader, BasicSoundBank } = await import(
      `${this.vendorPath}/spessasynth/spessasynth_core.bundle.js`
    );
    const soundbank = SoundBankLoader.fromArrayBuffer(sf3Data.buffer);
    await BasicSoundBank.isSF3DecoderReady;
    const sf2Buffer = await soundbank.writeSF2({ decompress: true });
    return new Uint8Array(sf2Buffer);
  }

  // --- Abstract methods (override in subclasses) ---

  async _doInit() {
    throw new Error('Backend must implement _doInit()');
  }

  async _doLoadSoundFont(_path, _data) {
    throw new Error('Backend must implement _doLoadSoundFont()');
  }

  _doNoteOn(_midi, _velocity, _channel) {
    throw new Error('Backend must implement _doNoteOn()');
  }

  _doNoteOff(_midi, _channel) {
    throw new Error('Backend must implement _doNoteOff()');
  }

  _doProgramChange(_channel, _program) {
    throw new Error('Backend must implement _doProgramChange()');
  }

  // Optional - defaults are no-ops
  _doControlChange(_channel, _controller, _value) {}
  _doPitchBend(_channel, _value) {}

  _doAllNotesOff(_channel) {
    // Default: send noteOff to all 16 channels isn't feasible without tracking,
    // so backends should override this if supported.
  }

  _doAllSoundOff() {}

  _doDispose() {}
}
