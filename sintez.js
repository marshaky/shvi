export { encodeWAV, evaluate, generatePCM, run, tokenize, typeify };

// sample[n]= A ⋅ sin(2 * π * f * (n / R))

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

const amplitude = 32767;
const sampleRate = 44100;

function generatePCM(frequency, duration) {
  
  function fadeInPart(frequency, fadeSamples) {
    console.log(frequency)
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

const findSymbol = (symbol) =>
{
  console.log(symbol)
  const entry = environment.find(([key]) => key === symbol);
  if (!entry)
    throw new Error(`Unknown symbol: ${atom(symbol)}`);
  return entry[1];
}

const evaluate = (expression) => {
  if (typeof expression === "number")
    return expression;
  console.log(expression)
  // Handle the symbols
  if (typeof expression === "symbol") {
    console.log(expression)
    return findSymbol(expression);
  }

  if (Array.isArray(expression)) {
    const [head, ...rest] = expression;

    if (head === Symbol.for("tone")) {
      const [freq, dur] = rest;
      return generatePCM(freq, dur);
    }

    if (head === Symbol.for("sequence")) {
      return rest.map(evaluate).flat();
    }
    
    if (head === Symbol.for("repeat")) {
      const [count, expr] = rest;
      const evaluated = evaluate(expr);
      let output = [];
      for (let i = 0; i < count; i++) {
        output = output.concat(evaluated);
      }
      return output;
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

const environment = [
  [atom("C0"), 16.35],
  [atom("C#0"), 17.32],
  [atom("D0"), 18.35],
  [atom("D#0"), 19.45],
  [atom("E0"), 20.60],
  [atom("F0"), 21.83],
  [atom("F#0"), 23.12],
  [atom("G0"), 24.50],
  [atom("G#0"), 25.96],
  [atom("A0"), 27.50],
  [atom("A#0"), 29.14],
  [atom("B0"), 30.87],
  
  [atom("C1"), 32.70],
  [atom("C#1"), 34.65],
  [atom("D1"), 36.71],
  [atom("D#1"), 38.89],
  [atom("E1"), 41.20],
  [atom("F1"), 43.65],
  [atom("F#1"), 46.25],
  [atom("G1"), 49.00],
  [atom("G#1"), 51.91],
  [atom("A1"), 55.00],
  [atom("A#1"), 58.27],
  [atom("B1"), 61.74],
  
  [atom("C2"), 65.41],
  [atom("C#2"), 69.30],
  [atom("D2"), 73.42],
  [atom("D#2"), 77.78],
  [atom("E2"), 82.41],
  [atom("F2"), 87.31],
  [atom("F#2"), 92.50],
  [atom("G2"), 98.00],
  [atom("G#2"), 103.83],
  [atom("A2"), 110.00],
  [atom("A#2"), 116.54],
  [atom("B2"), 123.47],
  
  [atom("C3"), 130.81],
  [atom("C#3"), 138.59],
  [atom("D3"), 146.83],
  [atom("D#3"), 155.56],
  [atom("E3"), 164.81],
  [atom("F3"), 174.61],
  [atom("F#3"), 185.00],
  [atom("G3"), 196.00],
  [atom("G#3"), 207.65],
  [atom("A3"), 220.00],
  [atom("A#3"), 233.08],
  [atom("B3"), 246.94],
  
  [atom("C4"), 261.63],
  [atom("C#4"), 277.18],
  [atom("D4"), 293.66],
  [atom("D#4"), 311.13],
  [atom("E4"), 329.63],
  [atom("F4"), 349.23],
  [atom("F#4"), 369.99],
  [atom("G4"), 392.00],
  [atom("G#4"), 415.30],
  [atom("A4"), 440.00],
  [atom("A#4"), 466.16],
  [atom("B4"), 493.88],
  
  [atom("C5"), 523.25],
  [atom("C#5"), 554.37],
  [atom("D5"), 587.33],
  [atom("D#5"), 622.25],
  [atom("E5"), 659.26],
  [atom("F5"), 698.46],
  [atom("F#5"), 739.99],
  [atom("G5"), 783.99],
  [atom("G#5"), 830.61],
  [atom("A5"), 880.00],
  [atom("A#5"), 932.33],
  [atom("B5"), 987.77],
  
  [atom("C6"), 1046.50],
  [atom("C#6"), 1108.73],
  [atom("D6"), 1174.66],
  [atom("D#6"), 1244.51],
  [atom("E6"), 1318.51],
  [atom("F6"), 1396.91],
  [atom("F#6"), 1479.98],
  [atom("G6"), 1567.98],
  [atom("G#6"), 1661.22],
  [atom("A6"), 1760.00],
  [atom("A#6"), 1864.66],
  [atom("B6"), 1975.53],
  
  [atom("C7"), 2093.00],
  [atom("C#7"), 2217.46],
  [atom("D7"), 2349.32],
  [atom("D#7"), 2499.02],
  [atom("E7"), 2637.02],
  [atom("F7"), 2793.83],
  [atom("F#7"), 2959.96],
  [atom("G7"), 3135.96],
  [atom("G#7"), 3322.44],
  [atom("A7"), 3520.00],
  [atom("A#7"), 3729.31],
  [atom("B7"), 3951.07],
  
  [atom("C8"), 4186.01]
  
];
