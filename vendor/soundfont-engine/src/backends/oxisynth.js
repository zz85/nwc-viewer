import { BaseBackend } from './base.js';

/**
 * OxiSynth backend - Rust-based SoundFont2 synthesizer compiled to WASM.
 * Supports SF2 natively. SF3 is auto-converted via spessasynth_core (handled by BaseBackend).
 *
 * Features: noteOn, noteOff, programChange, controlChange, pitchBend, allNotesOff, allSoundOff
 */
export class OxiSynthBackend extends BaseBackend {
  constructor(options = {}) {
    super(options);
    this._synth = null;
    this._OxiSynth = null;
  }

  get capabilities() {
    return { sf3: false, controlChange: true, pitchBend: true };
  }

  async _doInit() {
    const modulePath = `${this.vendorPath}/oxisynth/oxisynth.js`;
    const mod = await import(modulePath);
    await mod.default(); // Initialize WASM
    this._OxiSynth = mod.OxiSynth;
    this._synth = new this._OxiSynth(this.audioContext.sampleRate || 44100);
  }

  async _doLoadSoundFont(path, data) {
    let idx = this._fontIndex.get(path);
    if (idx === undefined) {
      idx = this._synth.add_soundfont(data);
      this._fontIndex.set(path, idx);
    } else {
      this._synth.select_soundfont(idx);
    }
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

  _doControlChange(channel, controller, value) {
    this._synth.control_change(channel, controller, value);
  }

  _doPitchBend(channel, value) {
    this._synth.pitch_bend(channel, value);
  }

  _doAllNotesOff(channel) {
    if (channel === undefined) {
      for (let ch = 0; ch < 16; ch++) this._synth.all_notes_off(ch);
    } else {
      this._synth.all_notes_off(channel);
    }
  }

  _doAllSoundOff() {
    for (let ch = 0; ch < 16; ch++) this._synth.all_sound_off(ch);
  }

  _doDispose() {
    this._synth = null;
    this._OxiSynth = null;
  }
}
