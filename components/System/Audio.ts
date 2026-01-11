
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export class AudioController {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  musicInterval: any = null;
  currentStep: number = 0;

  constructor() {}

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15; // Background level
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  startMusic(level: number) {
    this.init();
    this.stopMusic();
    
    // Scale intensity with level
    const bpm = Math.min(120 + level * 0.5, 160);
    const stepTime = (60 / bpm) / 2; // 1/8th notes
    
    this.musicInterval = setInterval(() => {
      this.playBeat(level);
      this.currentStep = (this.currentStep + 1) % 16;
    }, stepTime * 1000);
  }

  playBeat(level: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const step = this.currentStep;

    // 1. Kick Drum (Steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      this.createKick(t);
    }

    // 2. Snare/Clap (Steps 4, 12)
    if (step === 4 || step === 12) {
      this.createSnare(t);
    }

    // 3. Bassline (Syncopated)
    if (step % 2 === 0) {
      const bassFreqs = [55, 65, 41, 49]; // A, C, F, G
      const baseFreq = bassFreqs[Math.floor(step / 4) % bassFreqs.length];
      this.createBass(t, baseFreq * (1 + (level % 3) * 0.01));
    }

    // 4. Lead Melody (Scales with level complexity)
    const melodyChance = 0.3 + (level * 0.005);
    if (Math.random() < melodyChance && (step % 2 !== 0)) {
        const scale = [440, 493, 523, 587, 659, 783, 880]; // A Minor
        const note = scale[Math.floor(Math.random() * scale.length)];
        this.createLead(t, note);
    }
  }

  createKick(t: number) {
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.1);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(g);
    g.connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  createSnare(t: number) {
    const noise = this.ctx!.createBufferSource();
    const bufferSize = this.ctx!.sampleRate * 0.1;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    noise.connect(g);
    g.connect(this.musicGain!);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  createBass(t: number, freq: number) {
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(g);
    g.connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  createLead(t: number, freq: number) {
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(g);
    g.connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playGemCollect() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playLetterCollect() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; 
    freqs.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const start = t + (i * 0.04);
        const dur = 0.3;
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(start);
        osc.stop(start + dur);
    });
  }

  playJump(isDouble = false) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isDouble ? 400 : 200;
    const endFreq = isDouble ? 800 : 450;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playDamage() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
    noise.start(t);
    noise.stop(t + 0.3);
  }
}

export const audio = new AudioController();
