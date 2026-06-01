# Runleader RL-BI025-BT — BLE protocol notes

Reverse-engineered from the official **Moresee** app and confirmed by live
on-device capture (iPhone + react-native-ble-plx, logged in this project). The
monitor uses the **AiLink / pingwang** BLE platform and advertises as
`AiLink_xxxx`. There is no public spec.

## Transport (GATT)

| Role | UUID |
|------|------|
| Service | `0000FFE0-0000-1000-8000-00805F9B34FB` |
| Write (commands) | `0000FFE1` (Write Without Response) |
| **Notify (realtime data)** | `0000FFE2` (Read / Notify) |
| Write+Notify (config) | `0000FFE3` |

The device **streams realtime frames on FFE2 by itself** once a client
subscribes. Reading is passive: connect → subscribe → decode. No handshake,
command, or polling is required.

Behavioural notes observed live:
- The monitor sends one burst of frames, then **disconnects**, then re-advertises.
  The app simply auto-reconnects on disconnect; a fresh voltage/SoC arrives each
  cycle (every few seconds).
- Only one BLE central can connect at a time — **close Moresee** before
  connecting from another app.
- The advertisement manufacturer data is `<496E> 00 1F 00 29 00 14 <MAC×6>`;
  the `00 1F 00 29 00 14` block is static device info (not live voltage), so the
  reading must come from the FFE2 connection, not the advert.

## Frame format (FFE2 notifications)

```
A7 | cidHi cidLo | len | payload (len bytes) | checksum | 7A
```

- Header `0xA7`, footer `0x7A`.
- `cid` = product id; `0x001F` (31) for the RL-BI025.
- `checksum = sum(bytes[1 .. len+3]) & 0xFF` (cid + len + payload).
- **Payload is plaintext** — there is no encryption on this firmware. (The
  AiLink SDK exposes an `mcuEncrypt` path, but it is a no-op here: every live
  frame decodes directly, and an XOR attempt corrupted them.)

## Decoded payload semantics

`payload[0]` = group (`1` = device info, `2` = realtime), `payload[1]` = subtype,
`payload[2]` = mode.

| group/sub/mode | meaning | decode |
|----------------|---------|--------|
| `02 03 01` | **voltage + state-of-charge** (used by the app) | `V = ((p[4]<<8)\|p[3]) / 100`; `pct = p[7]` |
| `01 00 02` | firmware/version string | ASCII, e.g. `H1.1S1.002` |
| `01 00 01` | device info | mirrors advert `1F 00 29 00 14` |
| `02 03 02` / `02 03 05` / `02 01 0x` | other realtime/config frames | observed but unmapped (setpoints, counters) |

Only the `02 03 01` voltage frame is consumed today.

## Verification (live captures)

| Raw FFE2 frame | Decodes to | Monitor showed |
|----------------|-----------|----------------|
| `A7 00 1F 08 02 03 01 97 17 E6 17 2B 03 7A` | `60.39 V`, `0x2B = 43 %` | ~59.75 V / 44 % (charging) |
| `A7 00 1F 08 02 03 01 3D 14 3F 14 0B DC 7A` | `51.81 V`, `0x0B = 11 %` | (resting, low SoC) |

`p[7]` (SoC) was initially mistaken for a counter; the ground-truth 44 % capture
confirmed it tracks battery percent. While charging the terminal voltage runs
high (~60 V on a 48 V pack) even at mid SoC — expected. See
`src/ble/runleader.ts`.
