/**
 * AudioWorklet processor for background-tab-safe MIDI scheduling.
 *
 * Runs on the audio thread at audio-rate priority. Tracks playback position
 * using sample-accurate frame counting and posts noteOn, cc, and time
 * messages back to the main thread.
 *
 * This file must be loaded via audioContext.audioWorklet.addModule().
 */
class MidiClockProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.notes = [];
    this.ccEvents = [];
    this.playing = false;
    this.startFrame = 0;
    this.lapseFrames = 0;
    this.speed = 1;
    this.lastNoteIdx = -1;
    this.lastCCIdx = -1;

    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      switch (type) {
        case 'load':
          this.notes = data.notes;
          this.ccEvents = data.cc || [];
          this.lastNoteIdx = -1;
          this.lastCCIdx = -1;
          this.lapseFrames = 0;
          break;
        case 'play':
          this.playing = true;
          this.startFrame = currentFrame - this.lapseFrames / this.speed;
          break;
        case 'pause':
          this.playing = false;
          break;
        case 'seek':
          this.lapseFrames = data.time * sampleRate;
          this.startFrame = currentFrame - this.lapseFrames / this.speed;
          this.lastNoteIdx = this.notes.findIndex((n) => n.time > data.time) - 1;
          this.lastCCIdx = this.ccEvents.findIndex((c) => c.time > data.time) - 1;
          break;
        case 'speed':
          this.speed = data.speed;
          this.startFrame = currentFrame - this.lapseFrames / this.speed;
          break;
      }
    };
  }

  process() {
    if (!this.playing || !this.notes.length) return true;

    this.lapseFrames = (currentFrame - this.startFrame) * this.speed;
    const lapse = this.lapseFrames / sampleRate;

    // Fire notes within the lookahead window
    for (let i = this.lastNoteIdx + 1; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (!note) break;
      if (note.time > lapse + 0.05) break; // 50ms lookahead
      if (note.time >= lapse - 0.02) {
        this.port.postMessage({ type: 'noteOn', note });
      }
      this.lastNoteIdx = i;
    }

    // Fire CC events within the lookahead window
    for (let i = this.lastCCIdx + 1; i < this.ccEvents.length; i++) {
      const cc = this.ccEvents[i];
      if (!cc) break;
      if (cc.time > lapse + 0.05) break;
      if (cc.time >= lapse - 0.02) {
        this.port.postMessage({ type: 'cc', cc });
      }
      this.lastCCIdx = i;
    }

    // Post time update every ~50ms (2048 samples at 44.1kHz)
    if (currentFrame % 2048 < 128) {
      this.port.postMessage({ type: 'time', lapse });
    }

    return true;
  }
}

registerProcessor('midi-clock', MidiClockProcessor);
