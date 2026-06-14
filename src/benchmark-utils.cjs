function normalizeWords(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordErrorRate(reference, hypothesis) {
  const expected = normalizeWords(reference);
  const actual = normalizeWords(hypothesis);
  const rows = Array.from({ length: expected.length + 1 }, () => new Array(actual.length + 1).fill(0));
  for (let index = 0; index <= expected.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= actual.length; index += 1) rows[0][index] = index;
  for (let row = 1; row <= expected.length; row += 1) {
    for (let column = 1; column <= actual.length; column += 1) {
      const substitution = rows[row - 1][column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1);
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, substitution);
    }
  }
  return expected.length ? rows[expected.length][actual.length] / expected.length : (actual.length ? 1 : 0);
}

function decodePcm16Wav(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Only RIFF/WAVE files are supported.");
  }
  let offset = 12;
  let format;
  let data;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    } else if (id === "data") {
      data = buffer.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!format || !data || format.audioFormat !== 1 || format.channels !== 1 || format.bitsPerSample !== 16) {
    throw new Error("Benchmark WAV files must be mono PCM 16-bit.");
  }
  const samples = new Float32Array(data.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = data.readInt16LE(index * 2) / 32768;
  return { sampleRate: format.sampleRate, samples };
}

module.exports = { decodePcm16Wav, normalizeWords, wordErrorRate };
