'use strict';

const assert = require('node:assert');

function varint(value) {
  const bytes = [];
  let remaining = Number(value);
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return Buffer.from(bytes);
}

function fieldVarint(number, value) {
  return Buffer.concat([varint(number << 3), varint(value)]);
}

function fieldBytes(number, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([varint((number << 3) | 2), varint(bytes.length), bytes]);
}

function fieldString(number, value) {
  return fieldBytes(number, Buffer.from(value, 'utf8'));
}

function createIdentityModel() {
  const dimension = fieldVarint(1, 1);
  const shape = fieldBytes(1, dimension);
  const tensorType = Buffer.concat([fieldVarint(1, 1), fieldBytes(2, shape)]);
  const type = fieldBytes(1, tensorType);
  const input = Buffer.concat([fieldString(1, 'x'), fieldBytes(2, type)]);
  const output = Buffer.concat([fieldString(1, 'y'), fieldBytes(2, type)]);
  const node = Buffer.concat([
    fieldString(1, 'x'),
    fieldString(2, 'y'),
    fieldString(3, 'identity'),
    fieldString(4, 'Identity')
  ]);
  const graph = Buffer.concat([
    fieldBytes(1, node),
    fieldString(2, 'voiceflow-runtime-smoke'),
    fieldBytes(11, input),
    fieldBytes(12, output)
  ]);
  const opset = fieldVarint(2, 13);
  return Buffer.concat([
    fieldVarint(1, 8),
    fieldString(2, 'voiceflow'),
    fieldBytes(7, graph),
    fieldBytes(8, opset)
  ]);
}

async function run() {
  const ort = require('onnxruntime-node');
  const session = await ort.InferenceSession.create(createIdentityModel());
  const input = new ort.Tensor('float32', Float32Array.from([42]), [1]);
  const result = await session.run({ x: input });
  assert.deepEqual([...result.y.data], [42]);
  await session.release();
  console.log(`ONNX Runtime native smoke passed on ${process.platform}/${process.arch}.`);
}

module.exports = { createIdentityModel, fieldBytes, fieldString, fieldVarint, varint };

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
