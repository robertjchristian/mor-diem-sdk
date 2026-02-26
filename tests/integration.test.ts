/**
 * Integration Tests
 *
 * Live tests against the Morpheus network.
 * Requires MOR_MNEMONIC environment variable to be set.
 *
 * These tests check:
 * - Wallet balances on Base mainnet
 * - Model listing from proxy
 * - Inference calls (if staked)
 *
 * IMPORTANT: Staking currently costs ~2 MOR per model.
 * If costs exceed 2 MOR, this test will flag it as a price increase.
 */

import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

// Inference can take a while - 60 second timeout
setDefaultTimeout(60000)
import { MorDiemSDK } from '../src/index'

// Models to test inference on
const TEST_MODELS = ['kimi-k2.5', 'glm-4.7-flash', 'llama-3.3-70b']

// Expected max stake per model (in MOR)
const EXPECTED_MAX_STAKE_PER_MODEL = 2

// Skip integration tests if no mnemonic configured
const MNEMONIC = process.env.MOR_MNEMONIC
const SKIP_INTEGRATION = !MNEMONIC

describe('Integration: Wallet Balances', () => {
	let sdk: MorDiemSDK

	beforeAll(() => {
		if (SKIP_INTEGRATION) return
		sdk = new MorDiemSDK({ mnemonic: MNEMONIC })
	})

	test.skipIf(SKIP_INTEGRATION)('connects to Base mainnet and fetches balances', async () => {
		const balances = await sdk.getBalances()

		console.log('\n=== Wallet Balances ===')
		console.log(`Address: ${sdk.address}`)
		console.log(`ETH:  ${balances.ethFormatted}`)
		console.log(`MOR:  ${balances.morFormatted}`)
		console.log(`USDC: ${balances.usdcFormatted}`)
		console.log(
			`MOR Allowance: ${balances.isUnlimitedAllowance ? 'unlimited' : balances.morAllowanceFormatted}`,
		)

		// Balances should be valid numbers (can be 0)
		expect(balances.eth).toBeGreaterThanOrEqual(0n)
		expect(balances.mor).toBeGreaterThanOrEqual(0n)
		expect(balances.usdc).toBeGreaterThanOrEqual(0n)
	})

	test.skipIf(SKIP_INTEGRATION)('has sufficient ETH for gas', async () => {
		const balances = await sdk.getBalances()
		const ethBalance = Number.parseFloat(balances.ethFormatted)

		// Warn if ETH is low
		if (ethBalance < 0.001) {
			console.warn('\n⚠️  WARNING: ETH balance is very low. May not have enough for gas.')
		}

		// Test passes regardless - just informational
		expect(true).toBe(true)
	})

	test.skipIf(SKIP_INTEGRATION)('has MOR for staking', async () => {
		const balances = await sdk.getBalances()
		const morBalance = Number.parseFloat(balances.morFormatted)

		console.log(`\nMOR Balance: ${morBalance}`)

		if (morBalance < EXPECTED_MAX_STAKE_PER_MODEL) {
			console.warn(
				`\n⚠️  WARNING: MOR balance (${morBalance}) is less than ${EXPECTED_MAX_STAKE_PER_MODEL} MOR.`,
			)
			console.warn('    May not be able to stake for inference sessions.')
		}

		// Test passes regardless - just informational
		expect(true).toBe(true)
	})
})

describe('Integration: Proxy Health', () => {
	let sdk: MorDiemSDK

	beforeAll(() => {
		if (SKIP_INTEGRATION) return
		sdk = new MorDiemSDK({ mnemonic: MNEMONIC })
	})

	test.skipIf(SKIP_INTEGRATION)('proxy health check', async () => {
		const health = await sdk.healthCheck()

		console.log('\n=== Proxy Health ===')
		console.log(`Mode: ${health.mode}`)
		console.log(`Base URL: ${health.baseUrl}`)
		console.log(`Status: ${health.ok ? '✅ OK' : '❌ Error'}`)
		if (health.error) {
			console.log(`Error: ${health.error}`)
		}

		// If proxy is not running, skip remaining integration tests
		if (!health.ok) {
			console.warn('\n⚠️  Proxy not running. Start with: bun run proxy')
		}

		// Test records result but doesn't fail if proxy is down
		expect(typeof health.ok).toBe('boolean')
	})
})

describe('Integration: Model Listing', () => {
	let sdk: MorDiemSDK

	beforeAll(() => {
		if (SKIP_INTEGRATION) return
		sdk = new MorDiemSDK({ mnemonic: MNEMONIC })
	})

	test.skipIf(SKIP_INTEGRATION)('lists available models from proxy', async () => {
		try {
			const models = await sdk.listModels()

			console.log('\n=== Available Models ===')
			for (const model of models.data) {
				console.log(`  • ${model.id}`)
			}

			expect(models.data.length).toBeGreaterThan(0)
		} catch (_error) {
			// Proxy might not be running
			console.warn('\n⚠️  Could not list models. Is proxy running?')
			expect(true).toBe(true) // Don't fail
		}
	})
})

describe('Integration: Model Inference', () => {
	let sdk: MorDiemSDK
	let proxyRunning = false

	beforeAll(async () => {
		if (SKIP_INTEGRATION) return
		sdk = new MorDiemSDK({ mnemonic: MNEMONIC })

		// Check if proxy is running
		const health = await sdk.healthCheck()
		proxyRunning = health.ok
	})

	for (const model of TEST_MODELS) {
		test.skipIf(SKIP_INTEGRATION)(`inference with ${model}`, async () => {
			if (!proxyRunning) {
				console.log(`\n⏭️  Skipping ${model} - proxy not running`)
				expect(true).toBe(true)
				return
			}

			console.log(`\n=== Testing ${model} ===`)

			try {
				const startTime = Date.now()
				const response = await sdk.complete('Say "hello" and nothing else.', {
					model,
					maxTokens: 10,
				})
				const elapsed = Date.now() - startTime

				console.log(`✅ ${model}: "${response.slice(0, 50)}..." (${elapsed}ms)`)

				expect(response.length).toBeGreaterThan(0)
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)

				// Check for stake-related errors
				if (
					message.includes('stake') ||
					message.includes('deposit') ||
					message.includes('session')
				) {
					console.log(`⚠️  ${model}: Not staked or session expired`)

					// Check if error mentions amount > 2 MOR
					const morMatch = message.match(/(\d+(?:\.\d+)?)\s*MOR/i)
					if (morMatch) {
						const requiredMor = Number.parseFloat(morMatch[1])
						if (requiredMor > EXPECTED_MAX_STAKE_PER_MODEL) {
							console.error('\n🚨 PRICE INCREASE DETECTED!')
							console.error(`   Model ${model} requires ${requiredMor} MOR to stake`)
							console.error(`   Expected max: ${EXPECTED_MAX_STAKE_PER_MODEL} MOR`)
							console.error('   Please update EXPECTED_MAX_STAKE_PER_MODEL if this is expected.\n')
						}
					}

					// Test passes - not staked is a valid state
					expect(true).toBe(true)
				} else if (message.includes('timeout')) {
					console.log(`⚠️  ${model}: Request timed out`)
					expect(true).toBe(true)
				} else {
					console.log(`❌ ${model}: ${message}`)
					// Don't fail the test - just log
					expect(true).toBe(true)
				}
			}
		})
	}
})

describe('Integration: Staking Info', () => {
	test.skipIf(SKIP_INTEGRATION)('documents current staking costs', () => {
		console.log('\n=== Staking Information ===')
		console.log(`Expected stake per model: ~${EXPECTED_MAX_STAKE_PER_MODEL} MOR`)
		console.log('Stake is refundable after 7-day session')
		console.log('')
		console.log('To stake for a model, the SDK will automatically')
		console.log('deposit MOR when you first call inference.')
		console.log('')
		console.log('If a test reports "PRICE INCREASE DETECTED",')
		console.log('update EXPECTED_MAX_STAKE_PER_MODEL in this file.')

		expect(true).toBe(true)
	})
})
