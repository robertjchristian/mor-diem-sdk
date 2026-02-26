#!/usr/bin/env bun
/**
 * Setup Morpheus Router with wallet credentials
 *
 * Reads MOR_MNEMONIC env var, derives private key, updates .env
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { deriveWallet } from '../index.js'

const envPath = './bin/morpheus/.env'

const mnemonic = process.env.MOR_MNEMONIC
if (!mnemonic) {
	console.error('❌ MOR_MNEMONIC environment variable required')
	console.error('   Set it with: export MOR_MNEMONIC="word1 word2 ..."')
	process.exit(1)
}

const index = Number.parseInt(process.env.MOR_WALLET_INDEX || '0', 10)
const wallet = deriveWallet(mnemonic, index)

console.log('\n🔐 Wallet Configuration\n')
console.log(`   Address:     ${wallet.address}`)
console.log(`   Index:       ${index}`)
console.log(`   Private Key: ${wallet.privateKey.slice(0, 10)}...${wallet.privateKey.slice(-6)}`)

// Update .env file
let envContent = readFileSync(envPath, 'utf-8')
envContent = envContent.replace(
	/^WALLET_PRIVATE_KEY=.*$/m,
	`WALLET_PRIVATE_KEY=${wallet.privateKey}`,
)
writeFileSync(envPath, envContent)

console.log(`\n✅ Updated ${envPath} with wallet private key\n`)
console.log('Next steps:')
console.log('   1. cd bin/morpheus')
console.log('   2. ./morpheus-router')
console.log('   3. In another terminal: bun run src/proxy/morpheus-proxy.mjs')
console.log('   4. In another terminal: bun run cli chat')
console.log('')
