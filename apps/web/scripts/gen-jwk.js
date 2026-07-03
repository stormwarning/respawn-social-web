// Generate an ES256 private JWK for the OAuth confidential client.
// Usage: node scripts/gen-jwk.js
// Copy the single-line JSON output into PRIVATE_JWK in your env.
import { generateKeyPair, exportJWK } from 'jose'

const { privateKey } = await generateKeyPair('ES256', { extractable: true })
const jwk = await exportJWK(privateKey)
jwk.use = 'sig'
jwk.alg = 'ES256'
jwk.kid = 'key1'

console.log(JSON.stringify(jwk))
