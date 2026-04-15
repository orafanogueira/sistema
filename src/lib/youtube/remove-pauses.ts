/**
 * Client-side silence removal from audio.
 * Portado do HTML remove-pauses.html do usuario.
 *
 * Threshold padrao: -40dB, silencio de 1.5s.
 * Roda no browser usando Web Audio API.
 */

interface RemovePausesOptions {
  silenceThresholdDb?: number;  // -40 padrao
  silenceDurationSec?: number;  // 1.5 padrao
}

export async function removePausesFromAudio(
  audioFile: Blob,
  opts: RemovePausesOptions = {}
): Promise<Blob> {
  const silenceThreshold = opts.silenceThresholdDb ?? -40;
  const silenceDuration = opts.silenceDurationSec ?? 1.5;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();

  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const silenceThresholdLinear = Math.pow(10, silenceThreshold / 20);
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const nonSilentRanges: [number, number][] = [];
  let isSilent = true;
  let segmentStart = 0;

  for (let i = 0; i < channelData.length; i++) {
    const amplitude = Math.abs(channelData[i]);
    if (amplitude > silenceThresholdLinear) {
      if (isSilent) {
        segmentStart = i;
        isSilent = false;
      }
    } else if (!isSilent && (i - segmentStart) / sampleRate > silenceDuration) {
      nonSilentRanges.push([segmentStart, i]);
      isSilent = true;
    }
  }
  // adiciona ultimo segmento se ficou aberto
  if (!isSilent) nonSilentRanges.push([segmentStart, channelData.length]);

  if (nonSilentRanges.length === 0) {
    throw new Error("Nenhum audio detectado acima do threshold");
  }

  const totalSamples = nonSilentRanges.reduce((sum, [s, e]) => sum + (e - s), 0);
  const processedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    totalSamples,
    sampleRate
  );

  let offset = 0;
  for (const [start, end] of nonSilentRanges) {
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      processedBuffer.copyToChannel(
        audioBuffer.getChannelData(ch).subarray(start, end),
        ch,
        offset
      );
    }
    offset += end - start;
  }

  const wavBuffer = audioBufferToWav(processedBuffer);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numOfChannels * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels: Float32Array[] = [];
  let offset = 0;

  const writeString = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + buffer.length * numOfChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, buffer.length * numOfChannels * 2, true);

  offset = 44;
  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return bufferArray;
}
