import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export type VnpayParams = Record<string, string | number | undefined>;

/**
 * Mirrors VNPAY's official sample `sortObject`: encode both key and value
 * (spaces as `+`, not `%20`), then sort by the encoded key. Param names are
 * plain ASCII so encoding the key is a no-op, but we follow the reference
 * implementation exactly to avoid subtle hash mismatches.
 */
function sortedEncodedEntries(params: VnpayParams): [string, string][] {
  return Object.keys(params)
    .filter(
      (key) =>
        params[key] !== undefined && params[key] !== null && params[key] !== '',
    )
    .map((key) => encodeURIComponent(key))
    .sort()
    .map((encodedKey) => {
      const originalKey = decodeURIComponent(encodedKey);
      const value = String(params[originalKey]);
      return [encodedKey, encodeURIComponent(value).replace(/%20/g, '+')] as [
        string,
        string,
      ];
    });
}

function toQueryString(entries: [string, string][]): string {
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
}

export function buildVnpaySignData(params: VnpayParams): string {
  return toQueryString(sortedEncodedEntries(params));
}

export function signVnpayParams(
  params: VnpayParams,
  secretKey: string,
): string {
  const signData = buildVnpaySignData(params);
  return createHmac('sha512', secretKey)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');
}

export function buildVnpayRedirectUrl(
  baseUrl: string,
  params: VnpayParams,
  secretKey: string,
): string {
  const secureHash = signVnpayParams(params, secretKey);
  const query = toQueryString(
    sortedEncodedEntries({ ...params, vnp_SecureHash: secureHash }),
  );
  return `${baseUrl}?${query}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Re-derives the signature over every field except vnp_SecureHash/
 * vnp_SecureHashType and compares it (constant-time) to the one VNPAY sent.
 */
export function verifyVnpaySignature(
  query: VnpayParams,
  secretKey: string,
): boolean {
  const receivedHash = query.vnp_SecureHash;
  if (!receivedHash || typeof receivedHash !== 'string') {
    return false;
  }
  const rest: VnpayParams = { ...query };
  delete rest.vnp_SecureHash;
  delete rest.vnp_SecureHashType;
  const expectedHash = signVnpayParams(rest, secretKey);
  return safeEqualHex(expectedHash, receivedHash);
}

export function formatVnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}

export function generateTxnRef(): string {
  return randomUUID().replace(/-/g, '');
}

/** VNPAY encodes amounts as integers with no decimal places (VND x100). */
export function toVnpayAmount(amount: number): number {
  return Math.round(amount * 100);
}

export function fromVnpayAmount(vnpAmount: number | string): number {
  return Number(vnpAmount) / 100;
}
