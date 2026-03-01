import { EventEmitter } from './events.js';

/**
 * MidiScheduler - AudioWorklet-based MIDI event scheduler.
 *
 * Runs on the audio thread for sample-accurate timing that survives
 * browser background tabs. Routes scheduled note and CC events to
 * any object implementing noteOn/noteOff/controlChange (e.g. SoundFontEngine).
 *
 * @example
 * ```js
 * const scheduler = new MidiScheduler(engine);
 * await scheduler.init();
 * scheduler.load({
 *   notes: [{ midi: 60, time: 0, duration: 0.5, velocity: 0.8, channel: 0 }],
 *   controlChanges: [],
 * });
 * scheduler.on('noteOn', (note) => highlightPianoKey(note.midi));
 * scheduler.play();
 * ```
 */
export class MidiScheduler extends EventEmitter {
  /**
   * @param {object} target - Object with noteOn/noteOff/controlChange methods (e.g. SoundFontEngine)
   * @param {object} [options]
   * @param {string} [options.workletPath] - Path to scheduler-worklet.js file
   */
  constructor(target, { workletPath } = {}) {
    super();
    this._target = target;
    this._workletPath = workletPath ?? null;
    this._node = null;
    this._ready = false;
    this._playing = false;
    this._currentTime = 0;
    this._speed = 1;
    this._duration = 0;
    this._notes = [];
    this._cc = [];
  }

  // --- Properties ---

  /** @returns {boolean} Whether the worklet is initialized */
  get ready() { return this._ready; }

  /** @returns {boolean} Whether playback is active */
  get playing() { return this._playing; }

  /** @returns {number} Current playback position in seconds */
  get currentTime() { return this._currentTime; }

  /** @returns {number} Total duration of loaded data in seconds */
  get duration() { return this._duration; }

  /** @returns {number} Playback speed multiplier */
  get speed() { return this._speed; }
  set speed(value) { this.setSpeed(value); }

  // --- Lifecycle ---

  /**
   * Initialize the AudioWorklet. Must be called before play().
   * Requires the target to have an audioContext property.
   */
  async init() {
    const ctx = this._target.audioContext;
    if (!ctx) {
      throw new Error('Target must have an audioContext property');
    }

    // Resolve worklet path
    const workletPath = this._workletPath ?? this._resolveWorkletPath();

    await ctx.audioWorklet.addModule(workletPath);
    this._node = new AudioWorkletNode(ctx, 'midi-clock');
    this._node.connect(ctx.destination); // Must be connected to keep processing

    this._node.port.onmessage = (e) => this._handleMessage(e.data);
    this._ready = true;
  }

  /**
   * Load MIDI note and control change data for playback.
   * Notes must be sorted by time.
   *
   * @param {object} data
   * @param {Array<{midi: number, time: number, duration: number, velocity: number, channel: number}>} data.notes
   * @param {Array<{time: number, channel: number, controller: number, value: number}>} [data.controlChanges]
   */
  load({ notes = [], controlChanges = [] } = {}) {
    this._notes = notes;
    this._cc = controlChanges;
    this._currentTime = 0;
    this._playing = false;

    // Compute duration from the last note end time
    this._duration = notes.reduce(
      (max, n) => Math.max(max, n.time + (n.duration || 0)),
      0
    );

    this._node?.port.postMessage({
      type: 'load',
      data: { notes, cc: controlChanges },
    });
  }

  // --- Transport ---

  /** Start or resume playback. */
  play() {
    if (!this._ready) {
      console.warn('[soundfont-engine] MidiScheduler: call init() before play()');
      return;
    }
    this._target.resume?.();
    this._playing = true;
    this._node.port.postMessage({ type: 'play' });
  }

  /** Pause playback (retains position). */
  pause() {
    this._playing = false;
    this._node?.port.postMessage({ type: 'pause' });
  }

  /** Stop playback and reset to the beginning. */
  stop() {
    this.pause();
    this.seek(0);
    this._target.allSoundOff?.();
  }

  /**
   * Seek to a position in seconds.
   * @param {number} time - Position in seconds
   */
  seek(time) {
    this._currentTime = time;
    this._node?.port.postMessage({ type: 'seek', data: { time } });
    this._target.allSoundOff?.();
  }

  /**
   * Set playback speed.
   * @param {number} speed - Multiplier (1.0 = normal, 2.0 = double speed)
   */
  setSpeed(speed) {
    this._speed = speed;
    this._node?.port.postMessage({ type: 'speed', data: { speed } });
  }

  /** Dispose the scheduler and disconnect the worklet node. */
  dispose() {
    this.stop();
    if (this._node) {
      this._node.disconnect();
      this._node = null;
    }
    this._ready = false;
    this.removeAllListeners();
  }

  // --- Internal ---

  _handleMessage(data) {
    const { type, note, cc, lapse } = data;

    switch (type) {
      case 'noteOn':
        // Route to synth
        this._target.noteOn?.(note.midi, note.velocity, note.channel ?? 0);
        // Emit for external consumers (e.g. visualization)
        this.emit('noteOn', note);
        // Schedule noteOff after duration
        if (note.duration > 0) {
          const offDelay = (note.duration * 1000) / this._speed;
          setTimeout(() => {
            this._target.noteOff?.(note.midi, note.channel ?? 0);
            this.emit('noteOff', note);
          }, offDelay);
        }
        break;

      case 'cc':
        this._target.controlChange?.(cc.channel ?? 0, cc.controller, cc.value);
        this.emit('cc', cc);
        break;

      case 'time':
        this._currentTime = lapse;
        this.emit('time', lapse);
        // Auto-stop at end
        if (lapse >= this._duration && this._playing) {
          this._playing = false;
          this.emit('end');
        }
        break;
    }
  }

  _resolveWorkletPath() {
    // Try to find the worklet relative to this module
    try {
      return new URL('./scheduler-worklet.js', import.meta.url).href;
    } catch {
      return './scheduler-worklet.js';
    }
  }
}
