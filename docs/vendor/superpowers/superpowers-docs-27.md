---
name: superpowers-docs-27
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 27/33 (README.md)"
type: reference
---

### Task 1: Implement WebSocket protocol exports

**Files:**
- Create: `skills/brainstorming/scripts/server.js`
- Test: `tests/brainstorm-server/ws-protocol.test.js` (already exists)

- [ ] **Step 1: Create server.js with OPCODES constant and computeAcceptKey**

```js
const crypto = require('crypto');

const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}
```

- [ ] **Step 2: Implement encodeFrame**

Server frames are never masked. Three length encodings:
- payload < 126: 2-byte header (FIN+opcode, length)
- 126-65535: 4-byte header (FIN+opcode, 126, 16-bit length)
- &gt; 65535: 10-byte header (FIN+opcode, 127, 64-bit length)

```js
function encodeFrame(opcode, payload) {
  const fin = 0x80;
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = fin | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = fin | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = fin | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}
```

- [ ] **Step 3: Implement decodeFrame**

Client frames are always masked. Returns `{ opcode, payload, bytesConsumed }` or `null` for incomplete. Throws on unmasked frames.

```js
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0F;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7F;
  let offset = 2;

  if (!masked) throw new Error('Client frames must be masked');

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const maskOffset = offset;
  const dataOffset = offset + 4;
  const totalLen = dataOffset + payloadLen;
  if (buffer.length < totalLen) return null;

  const mask = buffer.slice(maskOffset, dataOffset);
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  }

  return { opcode, payload: data, bytesConsumed: totalLen };
}
```

- [ ] **Step 4: Add module exports at the bottom of the file**

```js
module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
```

- [ ] **Step 5: Run unit tests**

Run: `cd tests/brainstorm-server && node ws-protocol.test.js`
Expected: All tests pass (handshake, encoding, decoding, boundaries, edge cases)

- [ ] **Step 6: Commit**

```bash
git add skills/brainstorming/scripts/server.js
git commit -m "Add WebSocket protocol layer for zero-dep brainstorm server"
```

---

## Chunk 2: HTTP Server and Application Logic
