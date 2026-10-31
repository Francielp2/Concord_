// Sons locais da chamada, tocados por WebAudio: avisos de entrada/saída e soundboard.

export const MAX_SOUND_SECONDS = 5;

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// O navegador só libera o áudio depois de um gesto: chamar dentro de um clique.
export function unlockAudio() {
  audio();
}

// Duas notas curtas: sobe quando alguém entra, desce quando alguém sai.
export function playCue(kind: "join" | "leave") {
  const ac = audio();
  const notes = kind === "join" ? [523.25, 783.99] : [659.25, 440];
  notes.forEach((freq, i) => {
    const start = ac.currentTime + i * 0.09;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

function loadBuffer(url: string) {
  let pending = buffers.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`som não carregou (${res.status})`);
        return res.arrayBuffer();
      })
      .then((data) => audio().decodeAudioData(data));
    pending.catch(() => buffers.delete(url));
    buffers.set(url, pending);
  }
  return pending;
}

// Corta no limite aqui também: o tamanho informado no envio vem do navegador de quem subiu.
export async function playSound(url: string, volume: number) {
  const buffer = await loadBuffer(url);
  const ac = audio();
  const source = ac.createBufferSource();
  const gain = ac.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain).connect(ac.destination);
  source.start();
  source.stop(ac.currentTime + MAX_SOUND_SECONDS);
}

export async function measureAudio(file: File) {
  const buffer = await audio().decodeAudioData(await file.arrayBuffer());
  return buffer.duration;
}
