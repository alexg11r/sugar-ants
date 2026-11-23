import { GameSettings, SoundtrackId } from './types';

export interface SoundtrackDef {
  id: SoundtrackId;
  name: string;
  subtitle: string;
  mode: 'ambient' | 'triphop' | 'triphop_dub' | 'triphop_velvet' | 'aphex';
  droneFreqs: number[];
  scale: number[];
  filterFreq: number;
  waveType: OscillatorType;
  melodyIntervalMs: number;
}

export const SOUNDTRACKS: SoundtrackDef[] = [
  {
    id: 'emerald',
    name: 'Изумрудный шёпот',
    subtitle: 'Тёплый эмбиент-дрон и перезвоны калимбы',
    mode: 'ambient',
    droneFreqs: [73.42, 110.0, 185.0],
    scale: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99],
    filterFreq: 420,
    waveType: 'sine',
    melodyIntervalMs: 3600
  },
  {
    id: 'triphop',
    name: 'Бристольский туман',
    subtitle: 'Трип-хоп в духе Portishead и Massive Attack',
    mode: 'triphop',
    droneFreqs: [65.41, 98.0, 155.56],
    scale: [261.63, 293.66, 311.13, 349.23, 392.0, 415.3, 466.16, 523.25],
    filterFreq: 380,
    waveType: 'triangle',
    melodyIntervalMs: 2400
  },
  {
    id: 'triphop_dub',
    name: 'Ночной винил',
    subtitle: 'Глубокий даб-трип-хоп 72 BPM в ре-миноре',
    mode: 'triphop_dub',
    droneFreqs: [73.42, 110.0, 174.61],
    scale: [293.66, 329.63, 349.23, 392.0, 440.0, 466.16, 523.25, 587.33],
    filterFreq: 340,
    waveType: 'triangle',
    melodyIntervalMs: 2600
  },
  {
    id: 'triphop_velvet',
    name: 'Бархатная тень',
    subtitle: 'Меланхоличный трип-хоп с переборами арфы',
    mode: 'triphop_velvet',
    droneFreqs: [82.41, 123.47, 196.0],
    scale: [329.63, 369.99, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25],
    filterFreq: 410,
    waveType: 'sine',
    melodyIntervalMs: 2300
  },
  {
    id: 'aphex',
    name: 'Кремниевый сон',
    subtitle: 'IDM-электроника в духе Aphex Twin (SAW)',
    mode: 'aphex',
    droneFreqs: [87.31, 130.81, 220.0],
    scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25, 659.25],
    filterFreq: 640,
    waveType: 'sawtooth',
    melodyIntervalMs: 1800
  },
  {
    id: 'lunar',
    name: 'Лунная пыль',
    subtitle: 'Воздушные хрустальные ноты в ля-миноре',
    mode: 'ambient',
    droneFreqs: [110.0, 164.81, 261.63],
    scale: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25],
    filterFreq: 560,
    waveType: 'triangle',
    melodyIntervalMs: 4200
  },
  {
    id: 'deep_nest',
    name: 'Глубокое гнездо',
    subtitle: 'Землистый резонанс и спокойная маримба',
    mode: 'ambient',
    droneFreqs: [87.31, 130.81, 196.0],
    scale: [174.61, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25],
    filterFreq: 320,
    waveType: 'sine',
    melodyIntervalMs: 3100
  },
  {
    id: 'starlight',
    name: 'Звёздный путь',
    subtitle: 'Космические гармоники и высокие колокольчики',
    mode: 'ambient',
    droneFreqs: [82.41, 123.47, 207.65],
    scale: [329.63, 369.99, 415.3, 493.88, 554.37, 659.25, 739.99, 830.61],
    filterFreq: 680,
    waveType: 'sine',
    melodyIntervalMs: 2900
  }
];

export class MeditativeAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private padNodes: { stop: () => void }[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private seqTimer: number | null = null;
  private autoSwitchTimer: number | null = null;
  private stepIndex = 0;

  private settings: GameSettings;
  private initialized = false;
  private lastDigSound = 0;
  private lastArtSound = 0;
  private lastExpireSound = 0;
  onTrackAutoSwitch?: (track: SoundtrackDef) => void;

  constructor(initialSettings: GameSettings) {
    this.settings = { ...initialSettings };
  }

  private getCurrentTrack(): SoundtrackDef {
    return SOUNDTRACKS.find((t) => t.id === this.settings.soundtrack) || SOUNDTRACKS[0];
  }

  isAnyAudioEnabled(): boolean {
    return this.settings.musicEnabled || this.settings.sfxEnabled;
  }

  applySettings(next: GameSettings) {
    const trackChanged = next.soundtrack !== this.settings.soundtrack;
    const autoChanged = next.autoSwitchTrack !== this.settings.autoSwitchTrack;
    this.settings = { ...next };

    if (!this.initialized) return;
    if (trackChanged) {
      this.rebuildMusicEngine();
    }
    if (autoChanged || trackChanged) {
      this.resetAutoSwitchTimer();
    }
    this.syncGains();
  }

  private resetAutoSwitchTimer() {
    if (this.autoSwitchTimer !== null) {
      window.clearInterval(this.autoSwitchTimer);
      this.autoSwitchTimer = null;
    }
    if (!this.settings.autoSwitchTrack) return;

    // Automatically rotate to the next soundtrack every 85 seconds
    this.autoSwitchTimer = window.setInterval(() => {
      if (!this.settings.autoSwitchTrack || !this.settings.musicEnabled) return;
      const idx = SOUNDTRACKS.findIndex((t) => t.id === this.settings.soundtrack);
      const nextTrack = SOUNDTRACKS[(idx + 1) % SOUNDTRACKS.length];
      this.settings.soundtrack = nextTrack.id;
      this.rebuildMusicEngine();
      this.onTrackAutoSwitch?.(nextTrack);
    }, 85000);
  }

  ensureStarted() {
    if (!this.initialized) {
      this.init();
    } else if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncGains();
  }

  private init() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.settings.volume * 0.58;
      this.masterGain.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.settings.musicEnabled ? 1.0 : 0.0;
      this.musicBus.connect(this.masterGain);

      // Pre-generate 1 second of white noise for trip-hop snares / hats / IDM clicks
      const sampleRate = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < sampleRate; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;

      this.initialized = true;
      this.rebuildMusicEngine();
      this.resetAutoSwitchTimer();
      this.syncGains();
    } catch {
      this.initialized = false;
    }
  }

  private stopMusicEngine() {
    for (const n of this.padNodes) {
      try {
        n.stop();
      } catch {
        // Ignore already stopped
      }
    }
    this.padNodes = [];
    if (this.seqTimer !== null) {
      window.clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }

  private rebuildMusicEngine() {
    this.stopMusicEngine();
    if (!this.ctx || !this.musicBus) return;

    const track = this.getCurrentTrack();
    this.stepIndex = 0;

    if (track.mode === 'triphop') {
      this.startTripHopEngine();
    } else if (track.mode === 'triphop_dub') {
      this.startTripHopDubEngine();
    } else if (track.mode === 'triphop_velvet') {
      this.startTripHopVelvetEngine();
    } else if (track.mode === 'aphex') {
      this.startAphexEngine();
    } else {
      this.startAmbientEngine(track);
    }
  }

  /* =========================================================
     1. AMBIENT MEDITATIVE ENGINE
     ========================================================= */
  private startAmbientEngine(track: SoundtrackDef) {
    if (!this.ctx || !this.musicBus) return;

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.16;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = track.filterFreq;
    filter.Q.value = 0.7;

    padGain.connect(filter);
    filter.connect(this.musicBus);

    track.droneFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : track.waveType;
      osc.frequency.value = freq;

      const voiceGain = this.ctx.createGain();
      voiceGain.gain.value = idx === 0 ? 0.48 : 0.22;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07 + idx * 0.032;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.07;

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);
      osc.connect(voiceGain);
      voiceGain.connect(padGain);

      osc.start();
      lfo.start();
      this.padNodes.push(osc, lfo);
    });

    this.seqTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const note = track.scale[Math.floor(Math.random() * track.scale.length)];
      this.playToneInternal(note, 2.2, 0.055, 'sine', 0, true);
    }, track.melodyIntervalMs);
  }

  /* =========================================================
     2. TRIP-HOP ENGINE (Portishead / Massive Attack ~76 BPM)
     ========================================================= */
  private startTripHopEngine() {
    if (!this.ctx || !this.musicBus) return;

    // Subtle dark vinyl/room low drone
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.06;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 260;
    padGain.connect(padFilter);
    padFilter.connect(this.musicBus);

    const drone = this.ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 65.41; // C2
    drone.connect(padGain);
    drone.start();
    this.padNodes.push(drone);

    // 76 BPM => 16th note = 197ms
    const stepMs = 197;
    const bassBars = [65.41, 51.91, 49.0, 58.27]; // C2 -> Ab1 -> G1 -> Bb1
    const chords: number[][] = [
      [261.63, 311.13, 392.0, 466.16], // Cm7
      [207.65, 261.63, 311.13, 392.0], // Abmaj7
      [196.0, 246.94, 293.66, 349.23], // G7 (dark tension)
      [233.08, 293.66, 349.23, 415.3]  // Bb7 / Fm6 feel
    ];
    const hauntNotes = [523.25, 466.16, 415.3, 392.0, 311.13];

    this.seqTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const step = this.stepIndex % 16;
      const bar = Math.floor(this.stepIndex / 16) % 4;
      const swingDelay = step % 2 === 1 ? 0.022 : 0;

      // Moody boom-bap kick: 0, 7, 10 (with slight variation)
      if (step === 0 || step === 10 || (step === 7 && bar % 2 === 1)) {
        this.playDrumKick(125, 40, 0.28, 0.26, swingDelay);
      }

      // Dusty dark snare on beats 2 & 4 (steps 4, 12)
      if (step === 4 || step === 12) {
        this.playTripHopSnare(swingDelay);
      }

      // Muted swung hi-hat
      if (step % 2 === 0 || step === 15) {
        const accent = step % 4 === 2 ? 0.045 : 0.024;
        this.playHat(accent, 0.05, 5200, swingDelay);
      }

      // Deep sub-bass pulse on steps 0, 6, 10
      if (step === 0 || step === 10) {
        const root = bassBars[bar];
        this.playWarmBass(root, step === 0 ? 0.95 : 0.65, 0.2, swingDelay);
      }

      // Moody Rhodes-like electric piano chord on beat 1 (and syncopated hit on 14)
      if (step === 0) {
        const chord = chords[bar];
        chord.forEach((f, idx) => {
          this.playRhodesNote(f, 2.4, 0.042, idx * 0.028);
        });
      }

      // Occasional eerie Portishead vibrato sine motif
      if ((step === 6 || step === 14) && Math.random() < 0.42) {
        const f = hauntNotes[Math.floor(Math.random() * hauntNotes.length)];
        this.playVibratoLead(f, 1.4, 0.036, swingDelay);
      }

      this.stepIndex++;
    }, stepMs);
  }

  /* =========================================================
     2B. TRIP-HOP DUB ENGINE («Ночной винил» ~72 BPM, D minor)
     ========================================================= */
  private startTripHopDubEngine() {
    if (!this.ctx || !this.musicBus) return;

    const stepMs = 208; // 72 BPM
    const bassBars = [73.42, 73.42, 58.27, 65.41]; // D2 -> D2 -> Bb1 -> C2
    const dubChords: number[][] = [
      [293.66, 349.23, 440.0], // Dm
      [293.66, 349.23, 440.0],
      [233.08, 293.66, 349.23], // Bb
      [261.63, 329.63, 392.0]   // C
    ];

    this.seqTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const step = this.stepIndex % 16;
      const bar = Math.floor(this.stepIndex / 16) % 4;
      const swing = step % 2 === 1 ? 0.025 : 0;

      // Deep dub kick pattern
      if (step === 0 || step === 9 || (step === 11 && bar === 3)) {
        this.playDrumKick(115, 36, 0.34, 0.27, swing);
      }
      // Crisp rimshot on 4 & 12 + dub snare ghost
      if (step === 4 || step === 12) {
        this.playTripHopSnare(swing);
      }
      if (step === 6 || step === 14) {
        this.playAnalogRim(0.045);
      }
      if (step % 2 === 0) {
        this.playHat(step % 4 === 2 ? 0.04 : 0.02, 0.045, 4800, swing);
      }

      // Heavy dub sub-bass
      if (step === 0 || step === 6 || step === 10) {
        this.playWarmBass(bassBars[bar], 0.85, 0.22, swing);
      }

      // Echoed dub chord stab on off-beat (step 3 + quiet echo on step 6)
      if (step === 3) {
        dubChords[bar].forEach((f) => this.playRhodesNote(f, 0.9, 0.048, swing));
      } else if (step === 6) {
        dubChords[bar].forEach((f) => this.playRhodesNote(f, 0.7, 0.024, swing));
      }

      this.stepIndex++;
    }, stepMs);
  }

  /* =========================================================
     2C. TRIP-HOP VELVET ENGINE («Бархатная тень» ~82 BPM, E minor)
     ========================================================= */
  private startTripHopVelvetEngine() {
    if (!this.ctx || !this.musicBus) return;

    const stepMs = 183; // 82 BPM
    const bassBars = [82.41, 65.41, 73.42, 61.74]; // E2 -> C2 -> D2 -> B1
    const harpNotes = [329.63, 392.0, 493.88, 587.33, 659.25, 493.88, 392.0, 369.99];

    this.seqTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const step = this.stepIndex % 16;
      const bar = Math.floor(this.stepIndex / 16) % 4;
      const swing = step % 2 === 1 ? 0.018 : 0;

      if (step === 0 || step === 7 || step === 10) {
        this.playDrumKick(132, 42, 0.25, 0.23, swing);
      }
      if (step === 4 || step === 12) {
        this.playTripHopSnare(swing);
      }
      if (step % 2 === 0 || step === 13) {
        this.playHat(0.026, 0.04, 6000, swing);
      }
      if (step === 0 || step === 8) {
        this.playWarmBass(bassBars[bar], 0.9, 0.17, swing);
      }
      // Melancholic plucked harp / Rhodes arpeggio
      if (step % 2 === 0) {
        const n = harpNotes[(step / 2 + bar) % harpNotes.length];
        this.playRhodesNote(n, 1.3, 0.036, swing);
      }
      if (step === 12 && bar % 2 === 1) {
        this.playVibratoLead(659.25, 1.5, 0.03, swing);
      }

      this.stepIndex++;
    }, stepMs);
  }

  /* =========================================================
     3. APHEX TWIN / IDM ENGINE (SAW 85–92 ~114 BPM)
     ========================================================= */
  private startAphexEngine() {
    if (!this.ctx || !this.musicBus) return;

    // Warm detuned Juno-style analog pad with slow resonant filter sweep
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.085;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 580;
    filter.Q.value = 2.6;

    const filterLfo = this.ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 0.09;
    const filterLfoGain = this.ctx.createGain();
    filterLfoGain.gain.value = 260;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();
    this.padNodes.push(filterLfo);

    padGain.connect(filter);
    filter.connect(this.musicBus);

    // Warm suspended pad voices (F2, C3, G3, A3) with lush analog detune
    const padFreqs = [87.31, 130.81, 196.0, 220.0];
    padFreqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = idx % 2 === 0 ? -7 : 7;
      const g = this.ctx.createGain();
      g.gain.value = idx === 0 ? 0.36 : 0.22;
      osc.connect(g);
      g.connect(padGain);
      osc.start();
      this.padNodes.push(osc);
    });

    // 114 BPM => 16th note = 131ms
    const stepMs = 131;
    const arpScale = [349.23, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    const bassProg = [87.31, 73.42, 116.54, 130.81]; // F2 -> D2 -> Bb2 -> C3

    this.seqTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const step = this.stepIndex % 16;
      const bar = Math.floor(this.stepIndex / 16) % 4;

      // Tight hypnotic SAW-style analog kick
      if (step === 0 || step === 6 || step === 10 || (step === 14 && bar === 3)) {
        this.playDrumKick(155, 48, 0.16, 0.19, 0);
      }

      // Syncopated crisp IDM micro-clicks & hats
      if (step === 2 || step === 5 || step === 8 || step === 11 || step === 13 || step === 15) {
        const bright = step === 8 || step === 15 ? 8500 : 6200;
        const vol = step === 8 ? 0.038 : 0.02;
        this.playHat(vol, 0.028, bright, 0);
      }

      // Soft analog rim/snare ghost hits
      if (step === 4 || step === 12 || (step === 9 && bar % 2 === 1)) {
        this.playAnalogRim(step === 9 ? 0.035 : 0.065);
      }

      // Warm sub-bass pulse
      if (step === 0 || step === 8) {
        this.playWarmBass(bassProg[bar], 0.55, 0.13, 0);
      }

      // Polyrhythmic FM glassy bell plucks (5-step & 7-step cycling!)
      if (this.stepIndex % 3 === 0 || this.stepIndex % 5 === 0) {
        const noteIdx = (this.stepIndex * 2 + bar) % arpScale.length;
        if (Math.random() < 0.72) {
          this.playFmBell(arpScale[noteIdx], 0.85, 0.048);
        }
      }

      this.stepIndex++;
    }, stepMs);
  }

  /* =========================================================
     SYNTHESIS PRIMITIVES
     ========================================================= */
  private playDrumKick(startHz: number, endHz: number, dur: number, vol: number, delay: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(endHz, now + dur * 0.55);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private playTripHopSnare(delay: number) {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;

    // Band-passed dusty noise crack
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1450;
    filter.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    src.start(now);
    src.stop(now + 0.26);

    // Low snare body thump
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, now);
    body.frequency.exponentialRampToValueAtTime(115, now + 0.09);
    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.08, now);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    body.connect(bGain);
    bGain.connect(this.musicBus);
    body.start(now);
    body.stop(now + 0.12);
  }

  private playHat(vol: number, dur: number, hpFreq: number, delay: number) {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    src.start(now);
    src.stop(now + dur + 0.01);
  }

  private playAnalogRim(vol: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.035);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  private playWarmBass(freq: number, dur: number, vol: number, delay: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  private playRhodesNote(freq: number, dur: number, vol: number, delay: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const tine = this.ctx.createOscillator();
    tine.type = 'triangle';
    tine.frequency.setValueAtTime(freq * 2, now);
    const tineGain = this.ctx.createGain();
    tineGain.gain.setValueAtTime(vol * 0.35, now);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    tine.connect(tineGain);
    tineGain.connect(this.musicBus);
    gain.connect(this.musicBus);
    osc.start(now);
    tine.start(now);
    osc.stop(now + dur + 0.04);
    tine.stop(now + 0.28);
  }

  private playVibratoLead(freq: number, dur: number, vol: number, delay: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vibGain = this.ctx.createGain();
    vibGain.gain.value = 4.5;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    vib.start(now);
    osc.stop(now + dur + 0.05);
    vib.stop(now + dur + 0.05);
  }

  private playFmBell(freq: number, dur: number, vol: number) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2.0, now);

    modGain.gain.setValueAtTime(freq * 0.55, now);
    modGain.gain.exponentialRampToValueAtTime(0.01, now + dur * 0.45);

    outGain.gain.setValueAtTime(0.0001, now);
    outGain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    outGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(this.musicBus);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + dur + 0.03);
    mod.stop(now + dur + 0.03);
  }

  private syncGains() {
    if (!this.ctx || !this.masterGain) return;
    if (this.isAnyAudioEnabled() && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.settings.volume * 0.58, now, 0.15);

    if (this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setTargetAtTime(this.settings.musicEnabled ? 1.0 : 0.0, now, 0.2);
    }
  }

  private playToneInternal(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0,
    isMusic = false
  ) {
    if (!this.ctx || !this.masterGain || !this.musicBus) return;
    if (isMusic && !this.settings.musicEnabled) return;
    if (!isMusic && !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(isMusic ? this.musicBus : this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playSpawn() {
    const scale = this.getCurrentTrack().scale;
    const note = scale[Math.floor(Math.random() * 5)];
    this.playToneInternal(note, 0.35, 0.11, 'sine');
  }

  /**
   * Gentle, pleasant organic nibble sound ONLY played when the camera is zoomed in
   * close and near the chewing ant (intensity in 0..1)!
   */
  playDigTick(intensity = 0.7) {
    if (intensity <= 0.05) return;
    const now = performance.now();
    if (now - this.lastDigSound < 125) return;
    this.lastDigSound = now;
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;

    const clamped = Math.max(0.05, Math.min(1, intensity));
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Soft organic wooden/crystalline marimba nibble tuned to current scale
    const scale = this.getCurrentTrack().scale;
    const base = (scale[Math.floor(Math.random() * 5)] || 320) * (0.96 + Math.random() * 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 1.12, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.78, t + 0.045);

    lp.type = 'lowpass';
    lp.frequency.value = 1100 + clamped * 900;

    const vol = 0.042 * clamped;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.058);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  /** Crisp subtle UI hover blip */
  playUiHover() {
    this.ensureStarted();
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.042, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.042);
  }

  /** Clean tactile UI button click */
  playUiClick() {
    this.ensureStarted();
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(195, t + 0.042);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  /** Original Sugar Ants studio signature: warm bioluminescent kalimba cascade as the ant draws GrAx! */
  playSplashLogo() {
    this.ensureStarted();
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;
    const notes = [329.63, 392.0, 493.88, 659.25, 783.99];
    notes.forEach((f, idx) => {
      this.playToneInternal(f, 0.52, 0.055, 'sine', 0.08 + idx * 0.095);
      this.playToneInternal(f * 2, 0.25, 0.02, 'triangle', 0.08 + idx * 0.095);
    });
  }

  /** Original atmospheric "Dive into the Colony" chapter swell: soft warm drone + glassy water-drop notes */
  playChapterIntro() {
    this.ensureStarted();
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const scale = this.getCurrentTrack().scale;
    const root = (scale[0] || 220) * 0.5;

    // Gentle subterranean warm swell
    for (const mult of [1, 1.5, 2]) {
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * mult, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(260, t);
      lp.frequency.exponentialRampToValueAtTime(920, t + 1.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(mult === 1 ? 0.09 : 0.045, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 2.5);
    }

    // Delicate glassy dewdrop chimes
    const chimes = [scale[2] || 329.63, scale[4] || 440, scale[5] || 493.88, (scale[2] || 329.63) * 2];
    chimes.forEach((f, idx) => {
      this.playToneInternal(f, 0.9, 0.055, 'sine', 0.25 + idx * 0.28);
    });
  }

  /** Crisp organic pop-pop-pop when initial nest chamber opens */
  playRevealPop(step: number) {
    this.ensureStarted();
    if (!this.ctx || !this.masterGain || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = 220 + step * 75;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.8, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.055);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Subtle joyful ding when completing a tutorial hint step */
  playHintDone() {
    this.playToneInternal(587.33, 0.22, 0.075, 'sine', 0);
    this.playToneInternal(880, 0.34, 0.085, 'sine', 0.06);
  }

  /** Magical shimmering arpeggio when discovering a Secret Collectible Artifact (e.g. Креветочка Руся!) */
  playArtifactFound() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, idx) => {
      this.playToneInternal(f, 0.95, 0.11, idx % 2 === 0 ? 'sine' : 'triangle', idx * 0.075);
    });
  }

  /** Grand euphoric iridescent fanfare when a map reaches 100% cleared! */
  playEpicClearFanfare() {
    const chord = [261.63, 329.63, 392.0, 493.88, 587.33, 783.99, 1046.5, 1318.5];
    chord.forEach((f, idx) => {
      this.playToneInternal(f, 2.4, 0.12, 'sine', idx * 0.085);
      this.playToneInternal(f * 0.5, 2.0, 0.05, 'triangle', idx * 0.085 + 0.04);
    });
  }

  playArtReveal() {
    const now = performance.now();
    if (now - this.lastArtSound < 280) return;
    this.lastArtSound = now;
    const scale = this.getCurrentTrack().scale;
    const note = scale[Math.min(scale.length - 1, 4 + Math.floor(Math.random() * 4))];
    this.playToneInternal(note * 2, 0.55, 0.05, 'sine');
  }

  playCrystal() {
    const scale = this.getCurrentTrack().scale;
    const idx = Math.floor(Math.random() * (scale.length - 2));
    this.playToneInternal(scale[idx], 0.45, 0.12, 'sine', 0);
    this.playToneInternal(scale[idx + 2], 0.55, 0.1, 'sine', 0.08);
  }

  playSugarFound() {
    const scale = this.getCurrentTrack().scale;
    const chord = [scale[0], scale[2], scale[3], scale[5], scale[7] || scale[5] * 1.25];
    chord.forEach((f, i) => {
      this.playToneInternal(f, 1.8, 0.14, 'sine', i * 0.09);
    });
  }

  playUpgrade() {
    const scale = this.getCurrentTrack().scale;
    this.playToneInternal(scale[3], 0.28, 0.11, 'triangle', 0);
    this.playToneInternal(scale[5], 0.42, 0.13, 'sine', 0.07);
  }

  /** Subtle shimmering chime when Queen mutation spawns a special ant */
  playMutationSpawn() {
    const scale = this.getCurrentTrack().scale;
    this.playToneInternal(scale[4], 0.35, 0.075, 'sine', 0);
    this.playToneInternal(scale[6], 0.45, 0.065, 'sine', 0.07);
    this.playToneInternal(scale[7] || scale[6] * 1.2, 0.55, 0.055, 'triangle', 0.14);
  }

  /** Very quiet, gentle descending sigh when a summoned ant's lifespan ends */
  playAntExpire() {
    const now = performance.now();
    if (now - this.lastExpireSound < 600) return;
    this.lastExpireSound = now;
    const scale = this.getCurrentTrack().scale;
    this.playToneInternal(scale[2] * 0.5, 0.24, 0.042, 'sine', 0);
    this.playToneInternal(scale[0] * 0.5, 0.32, 0.035, 'sine', 0.08);
  }

  /** Warm golden ping when launching the Compass ant */
  playCompassLaunch() {
    const scale = this.getCurrentTrack().scale;
    this.playToneInternal(scale[3], 0.35, 0.09, 'sine', 0);
    this.playToneInternal(scale[5] * 1.5, 0.6, 0.07, 'sine', 0.06);
  }
}
