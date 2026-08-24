/**
 * Audio-thread level meter.
 *
 * The detection loop cannot live on requestAnimationFrame: Chrome suspends
 * rAF entirely in a hidden tab, and background timers are throttled to one
 * second, which is far too coarse for voice activity detection. An
 * AudioWorklet runs on the audio rendering thread, which keeps running
 * regardless of tab visibility, so hands-free keeps working when the user
 * switches away.
 *
 * Shipped as a source string and loaded from a blob URL so it needs no
 * separate static asset.
 */
export const LEVEL_WORKLET_SOURCE = `
class LevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.blocks = 0;
    this.sum = 0;
    this.count = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      for (let i = 0; i < channel.length; i += 1) this.sum += channel[i] * channel[i];
      this.count += channel.length;
      this.blocks += 1;
      // 8 blocks of 128 frames is roughly 21ms at 48kHz: fine enough for
      // speech onset, coarse enough not to flood the main thread.
      if (this.blocks >= 8) {
        this.port.postMessage(this.count ? Math.sqrt(this.sum / this.count) : 0);
        this.blocks = 0;
        this.sum = 0;
        this.count = 0;
      }
    }
    return true;
  }
}

registerProcessor('level-processor', LevelProcessor);
`;
