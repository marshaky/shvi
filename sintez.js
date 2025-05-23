export { encodeWAV, evaluate, generatePCM, run, tokenize, typeify };

const AMPLITUDE = 32767;
const SAMPLE_RATE = 44100;

// sample[n]= A ⋅ sin(2 * π * f * (n / R)​)

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

const amplitude = 32767;
const sampleRate = 44100;

function generatePCM(frequency, duration) {
  
  function fadeInPart(frequency, fadeSamples) {
    const samples = [];
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / sampleRate;
      const volume = i / fadeSamples;
      const sample = amplitude * volume * Math.sin(2 * Math.PI * frequency * t);
      samples.push(sample);
    }
    return samples;
  }
  
  function sustainPart(frequency, sustainSamples, startIndex) {
    const samples = [];
    for (let i = 0; i < sustainSamples; i++) {
      const t = (startIndex + i) / sampleRate;
      const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
      samples.push(sample);
    }
    return samples;
  }
  
  function fadeOutPart(frequency, fadeSamples, startIndex) {
    const samples = [];
    for (let i = 0; i < fadeSamples; i++) {
      const t = (startIndex + i) / sampleRate;
      const volume = (fadeSamples - i) / fadeSamples;
      const sample = amplitude * volume * Math.sin(2 * Math.PI * frequency * t);
      samples.push(sample);
    }
    return samples;
  }

  const totalSamples = Math.floor(sampleRate * (duration / 1000));
  const fadeSamples = Math.floor(totalSamples / 10);
  const sustainSamples = totalSamples - fadeSamples * 2;

  const fadeIn = fadeInPart(frequency, fadeSamples);
  const sustain = sustainPart(frequency, sustainSamples, fadeSamples);
  const fadeOut = fadeOutPart(frequency, fadeSamples, fadeSamples + sustainSamples);

  return [...fadeIn, ...sustain, ...fadeOut];
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

const typeify = (token) => {
  if (!isNaN(token)) return parseFloat(token);
  return atom(token);
};

const atom = (name) => Symbol.for(name);



const tokenize = (input) => {
  if (input.trim() === "") return [];
  const loop = (
    stack,
    [char, ...rest],
    token = "",
  ) => {
    if (char === undefined) {
      if (token) stack[stack.length - 1].push(typeify(token));
      return stack[0];
    }

    if (char === "(") {
      const newList = [];
      stack[stack.length - 1].push(newList);
      stack.push(newList);
      return loop(stack, rest, "");
    }

    if (char === ")") {
      if (token) stack[stack.length - 1].push(typeify(token));
      stack.pop();
      return loop(stack, rest, "");
    }

    if (char === " " || char === "\n" || char === "\t") {
      if (token) stack[stack.length - 1].push(typeify(token));
      return loop(stack, rest, "");
    }

    return loop(stack, rest, token + char);
  };

  return loop([[]], [...input]);
};

const evaluate = (expression) => {
  if (typeof expression === "number") return expression;

  if (Array.isArray(expression)) {
    const [head, ...rest] = expression;

    if (head === Symbol.for("tone")) {
      const [freq, dur] = rest;
      return generatePCM(freq, dur);
    }

    if (head === Symbol.for("sequence")) {
      return rest.map(evaluate).flat();
    }

    if (head === Symbol.for("parallel")) {
      const tones = rest.map(evaluate);
      const maxLength = Math.max(...tones.map(t => t.length));

      const padded = tones.map(t => {
        const missing = maxLength - t.length;
        return t.concat(new Array(missing).fill(0));
      });

      const result = [];
      for (let i = 0; i < maxLength; i++) {
        let sum = 0;
        for (const t of padded) {
          sum += t[i];
        }
        result.push(sum / padded.length);
      }

      return result;
    }

    throw new Error("Unknown command: " + head.toString());
  }
};

const run = (input) => {
  const tokens = tokenize(input);
  const expression = tokens[0];
  return evaluate(expression);
};
