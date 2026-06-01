# Runleader RL-BI025-BT — BLE protocol notes

Reverse-engineered from the official **Moresee** Android app (v1.1.9) and verified
against a live device. The monitor uses the **AiLink / pingwang** BLE platform.
There is no public spec; everything below was recovered from
`libAILinkBle-lib.so` + the `com.pingwang.moduleruilite` parser and confirmed
with a real capture (**56.25 V / 100 %**, MAC bytes `77 AE 04 FE B9 01`).

## Transport (GATT)

| Role | UUID |
|------|------|
| Service | `0000FFE0-0000-1000-8000-00805F9B34FB` |
| Write (commands) | `0000FFE1` (Write Without Response) |
| **Notify (realtime data)** | `0000FFE2` (Read / Notify) |
| Write+Notify (config) | `0000FFE3` |

The device advertises as `AiLink_xxxx` and **streams realtime frames on FFE2 by
itself** once a client subscribes. Reading is therefore passive: connect →
subscribe → decode. No handshake or polling is required (handshake only gates
*outbound* commands / binding).

> Only one BLE central can connect at a time — close Moresee before connecting
> from another app.

## Frame format (FFE2 notifications)

```
A7 | cidHi cidLo | len | <encrypted payload (len bytes)> | checksum | 7A
```

- Header `0xA7`, footer `0x7A` (these are MCU frames; `0xA6 … 0x6A` are "BLE"
  frames, unused here).
- `cid` = product id; **`0x001F` (31)** for the RL-BI025.
- `checksum` = `sum(bytes[1 .. len+3]) & 0xFF` (cid + len + payload).

## Payload encryption (symmetric XOR)

Despite the SDK calling it `mcuEncrypt`/TEA, the per-frame transform recovered
from the native `Java_..._mcuEncrypt` is a simple byte XOR:

```
plain[i] = enc[i] ^ macKey[i % 6] ^ cid[i & 1]
```

- `cid` bytes are each forced to ≥ 1 (a `0x00` byte is treated as `0x01`).
- `macKey` = the device's 6-byte MAC. iOS does not expose the MAC, so take the
  **trailing 6 bytes of the advertisement manufacturer data**
  (`… 77 AE 04 FE B9 01`). On Android the platform MAC string reversed yields
  the same 6 bytes.

The cipher is symmetric, so the same operation encrypts outbound commands.

(The advertisement also carries an encrypted realtime block via
`decryptBroadcast`, which uses standard TEA — key `0123456789ABCDEFFEDCBA9876543210`,
delta `0x9E3779B9`, 32 rounds — parameterised by device CID/PID. Not used here;
the connection path is simpler and verified.)

## Decoded payload semantics

`plain[0]` = group (`1` = device info, `2` = realtime), `plain[1]` = subtype.

| group/sub | meaning | decode |
|-----------|---------|--------|
| 2 / 3 (mode `plain[2]==1`) | **voltage + SoC** | `V = ((plain[4]<<8)\|plain[3]) / 100`; `pct = plain[7]` |
| 2 / 2 | RPM | `(plain[4]<<8)\|plain[3]`, max `(plain[6]<<8)\|plain[5]` |
| 2 / 5 | speed | `((plain[4]<<8)\|plain[3]) / 10` |
| 2 / 6 | odometer/mileage | 32-bit LE / 1000 |
| 2 / 4 | temperature | `… / 10` |
| 1 / 4 | device battery (coin cell) | `plain[4]`, `plain[3]` |

Only the voltage frame (2/3/1) is consumed by the app today.

## Verification

Captured frame `A7 00 1F 0B 74 B0 01 E1 B8 1E 76 B1 05 E1 B8 CB 7A`
→ checksum OK, decrypts to `02 01 04 00 00 00 00 00 00 00 00` (a valid zeroed
timing frame). A synthetic 56.25 V / 100 % voltage frame round-trips exactly.
See `src/ble/runleader.ts`.
