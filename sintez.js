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
    const sample = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * t));
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
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }
  await Deno.writeFile(output, new Uint8Array(buffer));
}

const atom = (name) => Symbol.for(name);

const typeify = (token) => {
  if (token === "")
    return null;
  if (!isNaN(token))
    return parseFloat(token);
  return atom(token);
};

const tokenize = (input) => {
  if (input.trim() === "") return [];

  const graphemes = Array.from(input);
  const loop = (progressiveScope, [graphemeAtHand, ...rest], tokenSoFar = "") => {
    if (graphemeAtHand === undefined) {
      if (tokenSoFar.length > 0) 
        progressiveScope[0].push(typeify(tokenSoFar));
      return progressiveScope[0];
    }
    const newScopes = [];
    switch (true) {
      case graphemeAtHand === ' ':
        if (tokenSoFar.length > 0) 
          progressiveScope[0].push(typeify(tokenSoFar));
        return loop(progressiveScope, rest, "");
      case graphemeAtHand === '(':
        if (tokenSoFar.length > 0) 
          progressiveScope[0].push(typeify(tokenSoFar));
        progressiveScope[0].push(newScopes);
        return loop([newScopes, ...progressiveScope], rest, "");
      case graphemeAtHand === ')':
        if (tokenSoFar.length > 0) 
          progressiveScope[0].push(typeify(tokenSoFar));
        return loop(progressiveScope.slice(1), rest, "");
      default:
        return loop(progressiveScope, rest, tokenSoFar + graphemeAtHand);
    }
  };

  return loop([[]], graphemes);
};

const environment = {
  tone: (frequency, duration) => generatePCM(frequency, duration),
};

const evaluate = (expr) => {
  if (Array.isArray(expr)) {
    if (expr.length === 0) 
      throw new Error("Cannot evaluate an empty list.");
    const operator = evaluate(expr[0]);
    const args = expr.slice(1).map(evaluate);
    return operator(...args);
  }
  if (typeof expr === "symbol") {
    const name = Symbol.keyFor(expr);
    if (!(name in environment)) 
      throw new Error(`Unbound symbol: ${name}`);
    return environment[name];
  }
  return expr;
};
