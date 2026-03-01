import { BaseBackend } from './base.js';

/**
 * RustySynth backend - Rust-based SoundFont2 synthesizer compiled to WASM.
 * SF2 only - SF3 requires conversion (handled automatically by BaseBackend).
 *
 * Note: RustySynth has a more limited API than OxiSynth:
 * - No controlChange, pitchBend, allNotesOff, or allSoundOff support
 * - Each loadSoundFont call creates a new synth instance (no font stacking)
 */
export class RustySynthBackend extends BaseBackend {
  constructor(options = {}) {
    super(options);
    this._synth = null;
    this._RustySynth = null;
  }

  get capabilities() {
    return { sf3: false, controlChange: false, pitchBend: false };
  }

  async _doInit() {
    const modulePath = `${this.vendorPath}/rustysynth/rustysynth.js`;
    const mod = await import(modulePath);
    await mod.default(); // Initialize WASM
    this._RustySynth = mod.RustySynth;
  }

  async _doLoadSoundFont(path, data) {
    // RustySynth requires a new instance per soundfont
    this._synth = new this._RustySynth(data, this.audioContext.sampleRate || 44100);
  }

  _doNoteOn(midi, velocity, channel) {
    this._synth.note_on(channel, midi, Math.round(velocity * 127));
  }

  _doNoteOff(midi, channel) {
    this._synth.note_off(channel, midi);
  }

  _doProgramChange(channel, program) {
    this._synth.program_change(channel, program);
  }

  // RustySynth does not support these - no-ops with warnings on first call
  _doControlChange(channel, controller, value) {
    if (!this._warnedCC) {
      console.warn('[soundfont-engine] RustySynth backend does not support controlChange');
      this._warnedCC = true;
    }
  }

  _doPitchBend(channel, value) {
    if (!this._warnedPB) {
      console.warn('[soundfont-engine] RustySynth backend does not support pitchBend');
      this._warnedPB = true;
    }
  }

  _doAllNotesOff(_channel) {
    // Not supported by RustySynth
  }

  _doAllSoundOff() {
    // Not supported by RustySynth
  }

  _doDispose() {
    this._synth = null;
    this._RustySynth = null;
  }
}
