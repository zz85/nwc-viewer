/**
 * Lightweight event emitter mixin for the soundfont engine.
 * No dependencies - works in any modern browser.
 */
export class EventEmitter {
  #listeners = new Map();

  /**
   * Register an event listener.
   * @param {string} event
   * @param {Function} fn
   * @returns {this}
   */
  on(event, fn) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(fn);
    return this;
  }

  /**
   * Remove an event listener.
   * @param {string} event
   * @param {Function} fn
   * @returns {this}
   */
  off(event, fn) {
    this.#listeners.get(event)?.delete(fn);
    return this;
  }

  /**
   * Register a one-time event listener.
   * @param {string} event
   * @param {Function} fn
   * @returns {this}
   */
  once(event, fn) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      fn.apply(this, args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all registered listeners.
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    const fns = this.#listeners.get(event);
    if (fns) {
      for (const fn of fns) {
        try {
          fn.apply(this, args);
        } catch (e) {
          console.error(`[soundfont-engine] Error in '${event}' listener:`, e);
        }
      }
    }
  }

  /**
   * Remove all listeners, optionally for a specific event.
   * @param {string} [event]
   */
  removeAllListeners(event) {
    if (event) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
  }
}
