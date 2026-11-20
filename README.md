# huffman-coding-kit

Generates and applies variable-length prefix codes based on character frequency for text compression.

## Usage

```js
import { frequencies, generateCodes, encode, decode } from 'huffman-coding-kit';

const text = 'abracadabra';
const codes = generateCodes(frequencies(text));
const bits = encode(text, codes);
console.log(bits);          // e.g. "0100110010011"
console.log(decode(bits, codes)); // "abracadabra"
```

The package is ESM-only and has no dependencies.

## Why this exists

Huffman coding is the standard first step in lossless compression, but most
implementations either hide the tree behind an opaque compressor or expose it
with an API that changes between versions. This library keeps the tree and the
code table explicit: `generateCodes` returns a `Map` from character to bit
string, and `encode`/`decode` operate on that map directly. That makes it easy
to inspect the code table, persist it, or swap in a different prefix code
without touching the codec.

The trade-off is that the caller owns the code table. There is no built-in
container format that bundles the table with the payload; if you want to ship a
compressed string to another process you must transmit the table separately
(or rebuild it from the same frequency data). This is deliberate — bundling
would force a serialization format on users who may already have one.

## Awkward edge

A single-symbol alphabet is a real case, not a theoretical one (think of a
file containing only newlines). A strict Huffman tree would give that symbol
the empty code, which makes every bit string decode to that symbol repeatedly
and is impossible to decode unambiguously. This library assigns the one-bit
code `"0"` instead. If you round-trip such a string you will get one bit per
character rather than zero, which is the smallest honest encoding.

## API

- `frequencies(text)` — `Map<string, number>` of character counts.
- `buildHuffmanTree(freqMap)` — root node of the Huffman tree, or `null` for an empty map. Leaf nodes have `{ char, freq }`; internal nodes have `{ left, right, freq }`.
- `generateCodes(freqMap)` — `Map<string, string>` from character to bit string.
- `encode(text, codes)` — bit string of `'0'` and `'1'`.
- `decode(bits, codes)` — original text. Throws on unknown, duplicate, empty, or incomplete codes.
