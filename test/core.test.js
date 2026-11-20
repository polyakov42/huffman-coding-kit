import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frequencies,
  buildHuffmanTree,
  generateCodes,
  encode,
  decode,
} from '../src/index.js';

test('frequencies counts each character', () => {
  const f = frequencies('abracadabra');
  assert.equal(f.get('a'), 5);
  assert.equal(f.get('b'), 2);
  assert.equal(f.get('r'), 2);
  assert.equal(f.get('c'), 1);
  assert.equal(f.get('d'), 1);
  assert.equal(f.size, 5);
});

test('frequencies on empty string is empty', () => {
  const f = frequencies('');
  assert.equal(f.size, 0);
});

test('frequencies rejects non-strings', () => {
  assert.throws(() => frequencies(42), TypeError);
});

test('buildHuffmanTree returns null for empty map', () => {
  assert.equal(buildHuffmanTree(new Map()), null);
});

test('buildHuffmanTree returns a leaf for a single symbol', () => {
  const root = buildHuffmanTree(new Map([['x', 7]]));
  assert.equal(root.char, 'x');
  assert.equal(root.freq, 7);
});

test('buildHuffmanTree rejects non-positive frequencies', () => {
  assert.throws(() => buildHuffmanTree(new Map([['a', 0]])), RangeError);
  assert.throws(() => buildHuffmanTree(new Map([['a', -1]])), RangeError);
  assert.throws(() => buildHuffmanTree(new Map([['a', NaN]])), RangeError);
});

test('buildHuffmanTree total frequency equals sum of leaves', () => {
  const f = frequencies('abracadabra');
  const root = buildHuffmanTree(f);
  assert.equal(root.freq, 11);
});

test('generateCodes on empty map returns empty map', () => {
  const codes = generateCodes(new Map());
  assert.equal(codes.size, 0);
});

test('generateCodes gives a single symbol a one-bit code', () => {
  const codes = generateCodes(new Map([['x', 3]]));
  assert.equal(codes.size, 1);
  assert.equal(codes.get('x'), '0');
});

test('generateCodes produces a prefix code', () => {
  const codes = generateCodes(frequencies('abracadabra'));
  const list = [...codes.values()];
  for (const a of list) {
    for (const b of list) {
      if (a !== b) {
        assert.equal(a.startsWith(b), false, `${a} should not start with ${b}`);
      }
    }
  }
});

test('generateCodes assigns shorter codes to more frequent characters', () => {
  const codes = generateCodes(frequencies('aaaaabbbbccd'));
  assert.ok(codes.get('a').length <= codes.get('b').length);
  assert.ok(codes.get('b').length <= codes.get('c').length);
  assert.ok(codes.get('c').length <= codes.get('d').length);
});

test('encode and decode round-trip', () => {
  const text = 'abracadabra';
  const codes = generateCodes(frequencies(text));
  const bits = encode(text, codes);
  assert.equal(decode(bits, codes), text);
});

test('encode and decode round-trip for a single symbol', () => {
  const text = 'xxxx';
  const codes = generateCodes(frequencies(text));
  const bits = encode(text, codes);
  assert.equal(bits, '0000');
  assert.equal(decode(bits, codes), text);
});

test('encode rejects characters with no code', () => {
  const codes = generateCodes(frequencies('abc'));
  assert.throws(() => encode('abd', codes), /no code/);
});

test('decode rejects an unknown trailing code', () => {
  const bad = new Map([['a', '0']]);
  assert.throws(() => decode('01', bad), /incomplete trailing code/);
});

test('decode rejects non-bit characters', () => {
  const codes = generateCodes(frequencies('abc'));
  assert.throws(() => decode('2', codes), /invalid bit/);
});

test('decode rejects duplicate codes', () => {
  const bad = new Map([['a', '0'], ['b', '0']]);
  assert.throws(() => decode('0', bad), /duplicate code/);
});

test('decode rejects empty code strings', () => {
  const bad = new Map([['a', '']]);
  assert.throws(() => decode('0', bad), /invalid code/);
});

test('empty text round-trips to empty bits and back', () => {
  const codes = generateCodes(frequencies('abc'));
  assert.equal(encode('', codes), '');
  assert.equal(decode('', codes), '');
});
