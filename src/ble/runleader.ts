/**
 * Runleader RL-BI025-BT battery monitor — BLE protocol decoder.
 *
 * The monitor runs the AiLink (pingwang) BLE module. It advertises as
 * `AiLink_xxxx`, exposes Nordic-style serial service `FFE0` with a notify
 * characteristic `FFE2`, and continuously pushes realtime "MCU" frames once a
 * client connects and subscribes — no handshake or polling required to read.
 *
 * Frame (bytes, as received on FFE2):
 *   A7 | cidHi cidLo | len | <encrypted payload (len bytes)> | checksum | 7A
 *   - header 0xA7, footer 0x7A
 *   - cid = product id (0x001F = 31 for this device)
 *   - checksum = (sum of bytes[1 .. len+2]) & 0xFF  (everything between
 *     header and checksum, inclusive of cid + len + payload)
 *
 * Payload is sent in the clear on this firmware (no encryption — the SDK's
 * `mcuEncrypt` is a no-op/disabled here, confirmed against the live device).
 *
 * Decoded payload semantics (subset we use):
 *   plain[0]=2, plain[1]=3, plain[2]=1  -> realtime voltage + SOC:
 *     voltage(V) = ((plain[4] << 8) | plain[3]) / 100
 *     percent    = plain[7]   (battery state-of-charge 0-100)
 *
 * Verified against a live device capture: payload `02 03 01 97 17 e6 17 2b`
 * -> 0x1797 / 100 = 60.39 V, 0x2b = 43 % (monitor showed ~59.75 V / 44 %).
 */

export const RUNLEADER_SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
/** Notify characteristic that streams realtime frames. */
export const RUNLEADER_NOTIFY_UUID = '0000FFE2-0000-1000-8000-00805F9B34FB';
/** Write characteristic (commands; unused for read-only monitoring). */
export const RUNLEADER_WRITE_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

const MCU_HEADER = 0xa7;
const MCU_FOOTER = 0x7a;

export type BatteryReading = {
  /** Pack voltage in volts (e.g. 56.25). */
  voltageV: number;
  /** State of charge 0-100, as reported by the monitor. */
  percent: number;
};

/** Derive the 6-byte XOR key from advertisement manufacturer data. */
export function macKeyFromManufacturerData(
  manufacturerData: Uint8Array | number[] | null | undefined,
): number[] | null {
  if (!manufacturerData) return null;
  const bytes = Array.from(manufacturerData);
  // Layout: [companyId(2)] [status(6)] [mac(6)] — the MAC is the trailing 6.
  if (bytes.length < 6) return null;
  return bytes.slice(bytes.length - 6);
}

/** Validate an MCU frame and return its cid + payload. */
export function parseFrame(
  frame: number[],
): { cid: [number, number]; payload: number[] } | null {
  if (frame.length < 6) return null;
  if (frame[0] !== MCU_HEADER) return null;
  if (frame[frame.length - 1] !== MCU_FOOTER) return null;

  const payloadLen = frame[3];
  // header(1) + cid(2) + len(1) + payload + checksum(1) + footer(1)
  if (frame.length < payloadLen + 6) return null;

  // checksum covers cid(2) + len(1) + payload(len) = indices 1 .. len+3
  let sum = 0;
  for (let i = 1; i <= payloadLen + 3; i++) sum = (sum + frame[i]) & 0xff;
  const checksum = frame[payloadLen + 4];
  if (sum !== checksum) return null;

  return {
    cid: [frame[1], frame[2]],
    payload: frame.slice(4, 4 + payloadLen),
  };
}

/** Parse a payload into a battery reading, if it is a voltage frame. */
export function parsePayload(plain: number[]): BatteryReading | null {
  // group 2 = realtime; subtype 3 = voltage; mode 1 = current value
  if (plain.length >= 8 && plain[0] === 2 && plain[1] === 3 && plain[2] === 1) {
    const raw = ((plain[4] << 8) | plain[3]) >>> 0;
    return {
      voltageV: raw / 100,
      percent: plain[7],
    };
  }
  return null;
}

/**
 * Decode one FFE2 notification into a battery reading. The device streams
 * plaintext frames, so we validate and parse directly.
 * Returns null for non-voltage frames (info/version/etc.) or invalid frames.
 */
export function decodeNotification(frame: number[]): BatteryReading | null {
  const parsed = parseFrame(frame);
  if (!parsed) return null;
  return parsePayload(parsed.payload);
}

/** Decode a base64 characteristic value (as delivered by react-native-ble-plx). */
export function bytesFromBase64(b64: string): number[] {
  // Minimal base64 -> bytes (avoids depending on Buffer/atob availability).
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = table.indexOf(clean[i]);
    const c1 = table.indexOf(clean[i + 1]);
    const c2 = table.indexOf(clean[i + 2]);
    const c3 = table.indexOf(clean[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined) out.push(n & 0xff);
  }
  return out;
}
