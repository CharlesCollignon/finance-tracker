/**
 * A bank's file as text. Many French banks still write theirs in
 * Windows-1252, and read as UTF-8 every « é » becomes a question mark: the
 * bytes are read as UTF-8 when they are valid UTF-8, and as Windows-1252
 * otherwise. The statement engine (`./statement`) reads the rest.
 */

/** Windows-1252's 0x80–0x9F, where it parts from Latin-1. */
const WINDOWS_1252_HIGH: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

/** The code points of `bytes` read as UTF-8, or null where they are not. */
function utf8CodePoints(bytes: Uint8Array): number[] | null {
  const points: number[] = [];
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index]!;
    let length: number;
    let point: number;
    if (first < 0x80) {
      points.push(first);
      index += 1;
      continue;
    } else if (first >= 0xc2 && first <= 0xdf) {
      length = 2;
      point = first & 0x1f;
    } else if (first >= 0xe0 && first <= 0xef) {
      length = 3;
      point = first & 0x0f;
    } else if (first >= 0xf0 && first <= 0xf4) {
      length = 4;
      point = first & 0x07;
    } else {
      return null;
    }
    if (index + length > bytes.length) {
      return null;
    }
    for (let next = 1; next < length; next += 1) {
      const byte = bytes[index + next]!;
      if ((byte & 0xc0) !== 0x80) {
        return null;
      }
      point = (point << 6) | (byte & 0x3f);
    }
    // Overlong forms and surrogates are not UTF-8 either.
    const smallest = length === 2 ? 0x80 : length === 3 ? 0x800 : 0x10000;
    if (
      point < smallest ||
      point > 0x10ffff ||
      (point >= 0xd800 && point <= 0xdfff)
    ) {
      return null;
    }
    points.push(point);
    index += length;
  }
  return points;
}

/** Turns code points into a string without overflowing the call stack. */
function fromCodePoints(points: readonly number[]): string {
  let text = "";
  const CHUNK = 8192;
  for (let start = 0; start < points.length; start += CHUNK) {
    text += String.fromCodePoint(...points.slice(start, start + CHUNK));
  }
  return text;
}

/**
 * A file's text: UTF-8 when the bytes are valid UTF-8, Windows-1252
 * otherwise — what a French bank's export is when it is not UTF-8. A byte
 * order mark is dropped.
 */
export function decodeStatement(bytes: Uint8Array): string {
  const utf8 = utf8CodePoints(bytes);
  const points =
    utf8 ?? Array.from(bytes, (byte) => WINDOWS_1252_HIGH[byte] ?? byte);
  const text = fromCodePoints(points);
  return text.replace(/^﻿/, "");
}
