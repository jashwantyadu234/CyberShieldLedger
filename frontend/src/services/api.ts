import axios from 'axios'

// Most screens use the default Axios export directly, while some import the
// configured client below. In development this remains same-origin so Vite
// proxies `/api` to FastAPI; in production it can call the API origin directly
// and does not depend on a hosting-provider rewrite.
const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
axios.defaults.baseURL = apiOrigin

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// ============================================================
// Web Crypto — Browser-held keypair for complaint signing
// ============================================================

const KEYPAIR_STORAGE_KEY = 'cybershield_signing_keypair'

/** Generate an RSA-PSS keypair and store in IndexedDB via localStorage key material. */
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  // Export private key to PKCS#8 for storage
  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicKeyRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privateKeyPem = arrayBufferToPem(privateKeyRaw, 'PRIVATE KEY')
  const publicKeyPem = arrayBufferToPem(publicKeyRaw, 'PUBLIC KEY')
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify({ privateKeyPem, publicKeyPem }))
  return keyPair
}

/** Load or generate the signing keypair. */
export async function getOrCreateSigningKeyPair(): Promise<{
  privateKeyPem: string
  publicKeyPem: string
}> {
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  await generateSigningKeyPair()
  return JSON.parse(localStorage.getItem(KEYPAIR_STORAGE_KEY)!)
}

/** Sign a SHA-256 hash with the user's private key. */
export async function signComplaintHash(hash: string): Promise<{
  signatureHex: string
  publicKeyPem: string
}> {
  const { privateKeyPem, publicKeyPem } = await getOrCreateSigningKeyPair()
  const privateKeyRaw = pemToArrayBuffer(privateKeyPem)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyRaw,
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const hashBytes = hexToArrayBuffer(hash)
  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    hashBytes,
  )
  const signatureHex = uint8ArrayToHex(new Uint8Array(signature))
  return { signatureHex, publicKeyPem }
}

// ============================================================
// PEM / ArrayBuffer utilities
// ============================================================

function arrayBufferToPem(raw: ArrayBuffer, label: string): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)))
  const lines = b64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----.*?-----/g, '').replace(/\s/g, '')
  const bytes = atob(b64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return buf.buffer
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Expected an even-length hexadecimal hash')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  return bytes.buffer as ArrayBuffer
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// SHA-256 Hashing utilities
// ============================================================

export async function sha256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return uint8ArrayToHex(new Uint8Array(hashBuffer))
}

export default api
