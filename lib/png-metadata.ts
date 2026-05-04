const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildTextChunk(keyword: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);
  const dataLength = keywordBytes.length + 1 + textBytes.length;
  const chunk = new Uint8Array(12 + dataLength);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, dataLength);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // "tEXt"
  chunk.set(keywordBytes, 8);
  chunk[8 + keywordBytes.length] = 0;
  chunk.set(textBytes, 8 + keywordBytes.length + 1);
  view.setUint32(8 + dataLength, crc32(chunk, 4, 8 + dataLength));

  return chunk;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)) as unknown as number[],
    );
  }
  return btoa(binary);
}

export function addPngTextChunks(
  pngDataUrl: string,
  metadata: Record<string, string>,
): string {
  const base64 = pngDataUrl.split(',')[1];
  if (!base64) return pngDataUrl;

  const bytes = base64ToBytes(base64);
  const iendStart = bytes.length - 12; // length(4) + "IEND"(4) + crc(4)

  const chunks = Object.entries(metadata).map(([k, v]) => buildTextChunk(k, v));
  const inserted = chunks.reduce((sum, c) => sum + c.length, 0);

  const out = new Uint8Array(bytes.length + inserted);
  out.set(bytes.subarray(0, iendStart), 0);
  let offset = iendStart;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  out.set(bytes.subarray(iendStart), offset);

  return `data:image/png;base64,${bytesToBase64(out)}`;
}
