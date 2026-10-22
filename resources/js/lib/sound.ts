/**
 * Efek suara game, sama dengan versi lama: benar.mp3 / salah.mp3 untuk hasil jawaban,
 * dan klik keypad mekanis yang disintesis dengan Web Audio. Jika file gagal diputar
 * (mis. autoplay diblokir), jatuh ke versi sintesis.
 */
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
    try {
        ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (ctx.state === 'suspended') void ctx.resume();
        return ctx;
    } catch {
        return null;
    }
}

const cache = new Map<string, HTMLAudioElement>();

function playFile(src: string, fallback: () => void) {
    try {
        let base = cache.get(src);
        if (!base) {
            base = new Audio(src);
            base.preload = 'auto';
            cache.set(src, base);
        }
        const audio = base.cloneNode(true) as HTMLAudioElement;
        audio.play().catch(fallback);
    } catch {
        fallback();
    }
}

/** Muat file suara lebih awal agar tidak ada jeda saat pertama diputar. */
export function preloadSounds() {
    ['/sounds/benar.mp3', '/sounds/salah.mp3'].forEach((src) => {
        if (!cache.has(src)) {
            const a = new Audio(src);
            a.preload = 'auto';
            cache.set(src, a);
        }
    });
}

export function playCorrect() {
    playFile('/sounds/benar.mp3', correctSynth);
}

export function playWrong() {
    playFile('/sounds/salah.mp3', wrongSynth);
}

/** Klik keypad: letupan noise tinggi + denting logam + "clack" rendah. */
export function playKey() {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;

    const snapLen = 0.015;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * snapLen), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    const highpass = ac.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(2200, now);
    const bandpass = ac.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(4800 + (Math.random() * 800 - 400), now);
    bandpass.Q.setValueAtTime(3.8, now);
    const snapGain = ac.createGain();
    snapGain.gain.setValueAtTime(0.75, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + snapLen);
    noise.connect(highpass).connect(bandpass).connect(snapGain).connect(ac.destination);

    const ping = ac.createOscillator();
    const pingGain = ac.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(3400 + Math.random() * 400, now);
    pingGain.gain.setValueAtTime(0.25, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    ping.connect(pingGain).connect(ac.destination);

    const clack = ac.createOscillator();
    const clackGain = ac.createGain();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(240 + Math.random() * 50, now);
    clack.frequency.exponentialRampToValueAtTime(70, now + 0.02);
    clackGain.gain.setValueAtTime(0.5, now);
    clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    clack.connect(clackGain).connect(ac.destination);

    noise.start(now);
    noise.stop(now + snapLen);
    ping.start(now);
    ping.stop(now + 0.012);
    clack.start(now);
    clack.stop(now + 0.02);
}

function wrongSynth() {
    const ac = audioContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.4);
    gain.gain.setValueAtTime(0.5, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.4);
}

function correctSynth() {
    const ac = audioContext();
    if (!ac) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const t = ac.currentTime + i * 0.08;
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.25);
    });
}
