/**
 * A fresh id, wherever the code runs: the platform's when it has one (Node,
 * a browser), else one made here — Hermes on an older build has no
 * `crypto.randomUUID`, and a split's group is made on the device.
 */
export function newUuid(): string {
  const platform = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (platform?.randomUUID) {
    return platform.randomUUID();
  }
  const hex = "0123456789abcdef";
  let out = "";
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      out += "-";
    } else if (index === 14) {
      out += "4";
    } else if (index === 19) {
      out += hex[8 + Math.floor(Math.random() * 4)];
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}
