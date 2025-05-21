export { encodeWAV, evaluate, generatePCM, tokenize, typeify };

// sample[n]= A ⋅ sin(2 * π * f * (n / R)​)

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function generatePCM(frequency, duration) {
  const amplitude = 32767;
  const sampleRate = 44100;

  const numSamples = Math.floor(sampleRate * (duration / 1000));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
    samples.push(sample);
  }

  return samples;
}

async function encodeWAV(
  samples,
  output = "output.wav",
  sampleRate = 44100,
) {
  const headerSize = 44;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }

  await Deno.writeFile(
    output,
    new Uint8Array(buffer),
  );
}

const atom = (name) => Symbol.for(name);

const typeify = (token) => {
  throw new Error("Not implemented");
};

const tokenize = (input) => {
  const chars = Array.from(input);
  const loop = (chars, current = '', acc = []) => {
    if (chars.length === 0) {
      if (current.trim() !== '') {
        acc.push(isNaN(current) ? atom(current) : parseFloat(current));
      }
      return acc;
    }
    const [first, ...rest] = chars;
    switch (first) {
      case ' ':
        if (current.trim() !== '') {
          acc.push(isNaN(current) ? atom(current) : parseFloat(current));
        }
        return loop(rest, '', acc);
        case '(':
        case ')':
          if (current.trim() !== '')
            ac.push(isNaN(current) ? atom(current) : parseFloat(current));
          acc.push(first);
          return loop(rest, '', acc)
      default:
        return loop(rest, current + first, acc);
    }
  };
  return loop(chars);
}

const evaluate = (expression) => {
  throw new Error("TBI");
};