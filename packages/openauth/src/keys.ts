import {
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  JWK,
  KeyLike,
} from "jose"
import { Storage, StorageAdapter } from "./storage/storage.js"

const signingAlg = "ES256"
const encryptionAlg = "RSA-OAEP-512"

interface SerializedKeyPair {
  id: string
  publicKey: string
  privateKey: string
  created: number
  alg: string
  expired?: number
}

export interface KeyPair {
  id: string
  alg: string
  public: KeyLike
  private: KeyLike
  created: Date
  expired?: Date
  jwk: JWK
}

/**
 * @deprecated use `signingKeys` instead
 */
export async function legacySigningKeys(
  storage: StorageAdapter,
): Promise<KeyPair[]> {
  const alg = "RS512"
  const results = [] as KeyPair[]
  const scanner = Storage.scan<SerializedKeyPair>(storage, ["oauth:key"])
  for await (const [_key, value] of scanner) {
    const publicKey = await importSPKI(value.publicKey, alg, {
      extractable: true,
    })
    const privateKey = await importPKCS8(value.privateKey, alg)
    const jwk = await exportJWK(publicKey)
    jwk.kid = value.id
    results.push({
      id: value.id,
      alg,
      created: new Date(value.created),
      public: publicKey,
      private: privateKey,
      expired: new Date(1735858114000),
      jwk,
    })
  }
  return results
}

export async function signingKeys(storage: StorageAdapter): Promise<KeyPair[]> {
  const results = [] as KeyPair[]
  const scanner = Storage.scan<SerializedKeyPair>(storage, ["signing:key"])
  for await (const [_key, value] of scanner) {
    const publicKey = await importSPKI(value.publicKey, value.alg, {
      extractable: true,
    })
    const privateKey = await importPKCS8(value.privateKey, value.alg)
    const jwk = await exportJWK(publicKey)
    jwk.kid = value.id
    jwk.use = "sig"
    results.push({
      id: value.id,
      alg: signingAlg,
      created: new Date(value.created),
      expired: value.expired ? new Date(value.expired) : undefined,
      public: publicKey,
      private: privateKey,
      jwk,
    })
  }
  results.sort((a, b) => b.created.getTime() - a.created.getTime())
  if (results.filter((item) => !item.expired).length) return results

  const key = await generateKeyPair(signingAlg, {
    extractable: true,
  })
  const serialized: SerializedKeyPair = {
    id: crypto.randomUUID(),
    publicKey: await exportSPKI(key.publicKey),
    privateKey: await exportPKCS8(key.privateKey),
    created: Date.now(),
    alg: signingAlg,
  }
  await Storage.set(storage, ["signing:key", serialized.id], serialized)
  return signingKeys(storage)
}

export async function encryptionKeys(
  storage: StorageAdapter,
): Promise<KeyPair[]> {
  const results = [] as KeyPair[]
  const scanner = Storage.scan<SerializedKeyPair>(storage, ["encryption:key"])
  for await (const [_key, value] of scanner) {
    const publicKey = await importSPKI(value.publicKey, value.alg, {
      extractable: true,
    })
    const privateKey = await importPKCS8(value.privateKey, value.alg)
    const jwk = await exportJWK(publicKey)
    jwk.kid = value.id
    results.push({
      id: value.id,
      alg: encryptionAlg,
      created: new Date(value.created),
      expired: value.expired ? new Date(value.expired) : undefined,
      public: publicKey,
      private: privateKey,
      jwk,
    })
  }
  results.sort((a, b) => b.created.getTime() - a.created.getTime())
  if (results.filter((item) => !item.expired).length) return results

  const key = await generateKeyPair(encryptionAlg, {
    extractable: true,
  })
  const serialized: SerializedKeyPair = {
    id: crypto.randomUUID(),
    publicKey: await exportSPKI(key.publicKey),
    privateKey: await exportPKCS8(key.privateKey),
    created: Date.now(),
    alg: encryptionAlg,
  }
  await Storage.set(storage, ["encryption:key", serialized.id], serialized)
  return encryptionKeys(storage)
}
