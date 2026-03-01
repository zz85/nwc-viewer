import { BaseBackend } from './base.js';

/**
 * SpessaSynth backend - JavaScript SoundFont synthesizer with AudioWorklet rendering.
 * Supports both SF2 and SF3 natively (no conversion needed).
 *
 * Features: noteOn, noteOff, programChange, controlChange, pitchBend, allNotesOff, allSoundOff
 */
export class SpessaSynthBackend extends BaseBackend {
  constructor(options = {}) {
    super(options);
    this._synth = null;
    this._fontBanks = new Map(); // path -> bankOffset
    this._currentBank = 0;
    this._fontCounter = 0;
  }

  get capabilities() {
    return { sf3: true, controlChange: true, pitchBend: true };
  }

  async _doInit() {
    // SpessaSynth initialization is deferred to first loadSoundFont
    // because it needs the AudioWorklet registered first
  }

  async _doLoadSoundFont(path, data) {
    const ctx = this.audioContext;

    // If already loaded this font, just switch to it
    if (this._fontBanks.has(path)) {
      const bankOffset = this._fontBanks.get(path);
      this._currentBank = bankOffset;
      for (let ch = 0; ch < 16; ch++) {
        if (ch !== 9) { // skip percussion channel
          this._synth.controllerChange(ch, 0, bankOffset);
          this._synth.controllerChange(ch, 32, 0);
          this._synth.programChange(ch, this._synth.channelProperties?.[ch]?.program || 0);
        }
      }
      return;
    }

    // Initialize synth on first load
    if (!this._synth) {
      const { WorkletSynthesizer } = await import(
        `${this.vendorPath}/spessasynth/spessasynth_lib.bundle.js`
      );
      const processorPath = `${this.vendorPath}/spessasynth/spessasynth_processor.min.js`;
      await ctx.audioWorklet.addModule(processorPath);
      this._synth = new WorkletSynthesizer(ctx);
      this._synth.connect(ctx.destination);
      await this._synth.isReady;
    }

    // Add soundfont with a unique bank offset
    const bankOffset = this._fontCounter;
    await this._synth.soundBankManager.addSoundBank(data.buffer, path, bankOffset);
    this._fontBanks.set(path, bankOffset);
    this._currentBank = bankOffset;

    // Select this soundfont for all non-percussion channels
    for (let ch = 0; ch < 16; ch++) {
      if (ch !== 9) {
        this._synth.controllerChange(ch, 0, bankOffset);
        this._synth.controllerChange(ch, 32, 0);
        this._synth.programChange(ch, 0);
      }
    }
    this._fontCounter++;
  }

  _doNoteOn(midi, velocity, channel) {
    this._synth.noteOn(channel, midi, Math.round(velocity * 127));
  }

  _doNoteOff(midi, channel) {
    this._synth.noteOff(channel, midi);
  }

  _doProgramChange(channel, program) {
    // Set our current bank before program change (non-percussion only)
    if (this._currentBank !== undefined && channel !== 9) {
      this._synth.controllerChange(channel, 0, this._currentBank);
      this._synth.controllerChange(channel, 32, 0);
    }
    this._synth.programChange(channel, program);
  }

  _doControlChange(channel, controller, value) {
    this._synth.controllerChange(channel, controller, value);
  }

  _doPitchBend(channel, value) {
    this._synth.pitchWheel(channel, value);
  }

  _doAllNotesOff() {
    this._synth.stopAll();
  }

  _doAllSoundOff() {
    this._synth.stopAll(true);
  }

  _doDispose() {
    if (this._synth) {
      this._synth.stopAll(true);
      this._synth.disconnect();
    }
    this._synth = null;
    this._fontBanks.clear();
    this._fontCounter = 0;
  }
}
