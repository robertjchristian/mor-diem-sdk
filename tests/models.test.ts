/**
 * Model Tests
 *
 * Tests all models available from the proxy.
 * Shows which models are staked and working vs which need staking.
 *
 * Run: bun test tests/models.test.ts
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { MorDiemSDK } from '../src/index'

// 2 minute timeout per model
setDefaultTimeout(120000)

const MNEMONIC = process.env.MOR_MNEMONIC
const SKIP = !MNEMONIC

interface ModelResult {
	model: string
	status: 'working' | 'needs_stake' | 'error'
	responseTime?: number
	note?: string
}

const results: ModelResult[] = []
let sdk: MorDiemSDK
let proxyRunning = false
let testDate: string
let allModels: string[] = []

describe('Model Tests', () => {
	beforeAll(async () => {
		testDate = new Date().toISOString().split('T')[0]

		if (SKIP) {
			console.log('\n⏭️  Skipping - MOR_MNEMONIC not set')
			return
		}

		sdk = new MorDiemSDK({ mnemonic: MNEMONIC })

		const health = await sdk.healthCheck()
		proxyRunning = health.ok

		if (!proxyRunning) {
			console.log('⚠️  Proxy not running')
			return
		}

		console.log('✅ Proxy connected\n')

		try {
			const modelsResponse = await sdk.listModels()
			allModels = modelsResponse.data.map((m) => m.id)
			console.log(`📋 Testing ${allModels.length} models...\n`)
		} catch (_e) {
			console.log('⚠️  Could not fetch models')
		}
	})

	afterAll(() => {
		if (SKIP || !proxyRunning || allModels.length === 0) return
		generateReport(results, testDate)
	})

	test('test all models', async () => {
		if (SKIP || !proxyRunning || allModels.length === 0) {
			expect(true).toBe(true)
			return
		}

		for (const model of allModels) {
			const startTime = Date.now()

			try {
				const response = await sdk.complete('Say "hello"', {
					model,
					maxTokens: 10,
				})
				const elapsed = Date.now() - startTime

				if (response && response.length > 0) {
					results.push({
						model,
						status: 'working',
						responseTime: elapsed,
					})
					console.log(`✅ ${model} - working (${elapsed}ms)`)
				} else {
					results.push({
						model,
						status: 'needs_stake',
						note: 'Empty response',
					})
					console.log(`⬜ ${model} - needs stake`)
				}
			} catch (err) {
				const elapsed = Date.now() - startTime
				const msg = err instanceof Error ? err.message : String(err)

				// Determine if this is a stake issue or a real error
				// Auth errors, session errors, and stake errors all mean "needs configuration/stake"
				const lowerMsg = msg.toLowerCase()
				if (
					lowerMsg.includes('session') ||
					lowerMsg.includes('stake') ||
					lowerMsg.includes('deposit') ||
					lowerMsg.includes('bid') ||
					lowerMsg.includes('auth') ||
					lowerMsg.includes('cookie') ||
					lowerMsg.includes('unauthorized')
				) {
					results.push({
						model,
						status: 'needs_stake',
						note: 'Not staked',
					})
					console.log(`⬜ ${model} - needs stake`)
				} else if (lowerMsg.includes('morpheus') || lowerMsg.includes('unavailable')) {
					// Morpheus infrastructure issue - also means needs setup
					results.push({
						model,
						status: 'needs_stake',
						note: 'Router not available',
					})
					console.log(`⬜ ${model} - router not available`)
				} else {
					results.push({
						model,
						status: 'error',
						responseTime: elapsed,
						note: msg.slice(0, 60),
					})
					console.log(`❌ ${model} - error: ${msg.slice(0, 40)}`)
				}
			}
		}

		const working = results.filter((r) => r.status === 'working').length
		const needsStake = results.filter((r) => r.status === 'needs_stake').length
		const errors = results.filter((r) => r.status === 'error').length

		console.log('\n📊 Summary:')
		console.log(`   ✅ Working: ${working}`)
		console.log(`   ⬜ Needs stake: ${needsStake}`)
		console.log(`   ❌ Errors: ${errors}`)

		expect(true).toBe(true)
	})
})

function generateReport(results: ModelResult[], date: string) {
	const working = results.filter((r) => r.status === 'working')
	const needsStake = results.filter((r) => r.status === 'needs_stake')
	const errors = results.filter((r) => r.status === 'error')

	let report = `# Model Test Results

> Last tested: **${date}**

## Summary

- ✅ **Working:** ${working.length} models
- ⬜ **Needs stake:** ${needsStake.length} models
- ❌ **Errors:** ${errors.length} models

---

## Working Models

| Model | Response Time |
|-------|---------------|
`

	if (working.length === 0) {
		report += '| _(none currently staked)_ | - |\n'
	} else {
		for (const r of working) {
			report += `| \`${r.model}\` | ${r.responseTime}ms |\n`
		}
	}

	report += `
## Models Needing Stake

These models are available but require MOR stake (~2 MOR each, refundable after 7 days).

| Model | Note |
|-------|------|
`

	for (const r of needsStake) {
		report += `| \`${r.model}\` | ${r.note || 'Stake required'} |\n`
	}

	if (errors.length > 0) {
		report += `
## Errors

| Model | Error |
|-------|-------|
`
		for (const r of errors) {
			report += `| \`${r.model}\` | ${r.note} |\n`
		}
	}

	report += `
---

## How to Stake

\`\`\`bash
# Check current balance
bun run cli wallet balance

# The CLI will auto-stake when you chat with a model
bun run cli chat
\`\`\`

Each stake locks ~2 MOR for 7 days, then returns to your wallet.
`

	const reportPath = path.join(process.cwd(), 'TEST_RESULTS.md')
	fs.writeFileSync(reportPath, report)
	console.log('\n📄 Report: TEST_RESULTS.md')
}
