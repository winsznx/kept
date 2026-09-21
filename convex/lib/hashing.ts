const encoder = new TextEncoder();

export async function sha256Hex(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Canonical text form used for content hashing of captured sources: Unicode NFC,
 * LF line endings, trailing whitespace trimmed per line. Content changes of any
 * other kind produce a different hash, which is the point: raw-source change is
 * recorded separately from material commercial change.
 */
export function canonicalizeSourceText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export async function contentHash(text: string): Promise<string> {
  return sha256Hex(canonicalizeSourceText(text));
}
