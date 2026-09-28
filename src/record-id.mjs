const UUID_BYTE_COUNT = 16;
const UUID_VERSION_INDEX = 6;
const UUID_VARIANT_INDEX = 8;
const UUID_VERSION_MASK = 0x0f;
const UUID_VERSION_FOUR = 0x40;
const UUID_VARIANT_MASK = 0x3f;
const UUID_VARIANT_RFC = 0x80;
let fallbackSequence = 0;

/** @typedef {{randomUUID?:()=>string,getRandomValues?:(bytes:Uint8Array)=>Uint8Array}} IdCrypto */
/** Local record identifiers only; the non-crypto fallback must never be used for credentials.
 * @param {IdCrypto|null|undefined} [cryptoSource] @returns {string}
 */
export function createRecordId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID === 'function') return cryptoSource.randomUUID();
  if (typeof cryptoSource?.getRandomValues !== 'function') {
    fallbackSequence += 1;
    return `local-${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  const bytes = cryptoSource.getRandomValues(new Uint8Array(UUID_BYTE_COUNT));
  bytes[UUID_VERSION_INDEX] = (bytes[UUID_VERSION_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_FOUR;
  bytes[UUID_VARIANT_INDEX] = (bytes[UUID_VARIANT_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_RFC;
  const hex = Array.from(bytes,(byte) => byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
