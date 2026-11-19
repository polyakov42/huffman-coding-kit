// Huffman coding: variable-length prefix codes from character frequencies.
//
// Design choices:
// - Symbols are single-character strings (JS strings are UTF-16 code units).
//   This keeps the API simple; multi-codepoint grapheme support is deliberately
//   out of scope because it would require a segmentation dependency.
// - The priority queue is a simple binary heap keyed by frequency, with a
//   stable tie-break on insertion order so that code assignment is deterministic
//   across runs. Determinism matters for reproducible compressed output.
// - decode() rejects malformed input (unknown code, trailing bits that do not
//   form a complete code) by throwing, rather than silently dropping data.

class MinHeap {
  constructor() {
    this.items = [];
    this.seq = 0; // insertion counter for stable ordering
  }

  push(node) {
    node._seq = this.seq++;
    this.items.push(node);
    this._bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.items.length;
  }

  _less(a, b) {
    if (a.freq !== b.freq) return a.freq < b.freq;
    return a._seq < b._seq;
  }

  _bubbleUp(i) {
    const items = this.items;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._less(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  _bubbleDown(i) {
    const items = this.items;
    const n = items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this._less(items[left], items[smallest])) smallest = left;
      if (right < n && this._less(items[right], items[smallest])) smallest = right;
      if (smallest === i) break;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}

/**
 * Count occurrences of each character in the input string.
 * Returns a Map from character to count. Characters not present are absent.
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function frequencies(text) {
  if (typeof text !== 'string') {
    throw new TypeError('frequencies() expects a string');
  }
  const counts = new Map();
  for (const ch of text) {
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  return counts;
}

/**
 * Build a Huffman tree from a frequency map.
 * Returns the root node. Leaf nodes have { char, freq }; internal nodes have
 * { left, right, freq } and no char. For an empty map the result is null.
 * For a single-symbol map we still return a leaf node (see generateCodes).
 * @param {Map<string, number>} freqMap
 * @returns {object|null}
 */
export function buildHuffmanTree(freqMap) {
  if (!(freqMap instanceof Map)) {
    throw new TypeError('buildHuffmanTree() expects a Map');
  }
  const heap = new MinHeap();
  for (const [char, freq] of freqMap) {
    if (!Number.isFinite(freq) || freq <= 0) {
      throw new RangeError(`frequency for ${JSON.stringify(char)} must be a positive finite number`);
    }
    heap.push({ char, freq });
  }
  if (heap.size === 0) return null;
  while (heap.size > 1) {
    const a = heap.pop();
    const b = heap.pop();
    heap.push({ left: a, right: b, freq: a.freq + b.freq });
  }
  return heap.pop();
}

/**
 * Generate a prefix code for each character in the frequency map.
 * Returns a Map from character to bit string (e.g. "0", "10", "110").
 *
 * A single-symbol alphabet gets the one-bit code "0". This is a deliberate
 * choice: the empty code would make the encoding ambiguous (every string would
 * decode to that symbol repeatedly), so we emit one bit per symbol instead.
 * @param {Map<string, number>} freqMap
 * @returns {Map<string, string>}
 */
export function generateCodes(freqMap) {
  const root = buildHuffmanTree(freqMap);
  const codes = new Map();
  if (root === null) return codes;
  if (root.char !== undefined) {
    // Single distinct symbol: assign a one-bit code rather than the empty string.
    codes.set(root.char, '0');
    return codes;
  }
  const walk = (node, prefix) => {
    if (node.char !== undefined) {
      codes.set(node.char, prefix);
      return;
    }
    walk(node.left, prefix + '0');
    walk(node.right, prefix + '1');
  };
  walk(root, '');
  return codes;
}

/**
 * Encode a string into a bit string using the given codes.
 * Throws if a character has no assigned code.
 * @param {string} text
 * @param {Map<string, string>} codes
 * @returns {string} bit string of '0' and '1'
 */
export function encode(text, codes) {
  if (typeof text !== 'string') {
    throw new TypeError('encode() expects a string');
  }
  if (!(codes instanceof Map)) {
    throw new TypeError('encode() expects a Map of codes');
  }
  let out = '';
  for (const ch of text) {
    const code = codes.get(ch);
    if (code === undefined) {
      throw new Error(`no code for character ${JSON.stringify(ch)}`);
    }
    out += code;
  }
  return out;
}

/**
 * Decode a bit string back into text using the given codes.
 * Throws on unknown codes or on a trailing partial code, because silently
 * dropping bits would hide corruption.
 * @param {string} bits
 * @param {Map<string, string>} codes
 * @returns {string}
 */
export function decode(bits, codes) {
  if (typeof bits !== 'string') {
    throw new TypeError('decode() expects a string');
  }
  if (!(codes instanceof Map)) {
    throw new TypeError('decode() expects a Map of codes');
  }
  // Build the reverse map once. Duplicate codes cannot occur for a valid
  // prefix code, but we detect them anyway so the caller learns about a
  // malformed code table rather than getting silent mis-decoding.
  const reverse = new Map();
  for (const [ch, code] of codes) {
    if (typeof code !== 'string' || !/^[01]+$/.test(code)) {
      throw new Error(`invalid code for ${JSON.stringify(ch)}: ${JSON.stringify(code)}`);
    }
    if (reverse.has(code)) {
      throw new Error(`duplicate code ${JSON.stringify(code)}`);
    }
    reverse.set(code, ch);
  }
  let out = '';
  let buf = '';
  for (const bit of bits) {
    if (bit !== '0' && bit !== '1') {
      throw new Error(`invalid bit ${JSON.stringify(bit)}`);
    }
    buf += bit;
    if (reverse.has(buf)) {
      out += reverse.get(buf);
      buf = '';
    }
  }
  if (buf !== '') {
    throw new Error(`incomplete trailing code ${JSON.stringify(buf)}`);
  }
  return out;
}
