#!/usr/bin/env bun
/**
 * MOR DIEM CLI
 *
 * Command-line interface for the MOR DIEM SDK.
 *
 * Commands:
 *   wallet generate          Generate new 12-word mnemonic
 *   wallet derive [index]    Show address for wallet index
 *   wallet balance           Show MOR, ETH, USDC balances
 *   wallet approve           Approve MOR for staking
 *
 *   models                   List available models
 *   complete <message>       Quick inference test
 *   health                   Check API health
 *
 * Environment:
 *   MOR_API_KEY              API key for gateway mode (from app.mor.org)
 *   MOR_MNEMONIC             BIP39 mnemonic for wallet operations
 *   MOR_WALLET_INDEX         Wallet derivation index (default: 0)
 *   MOR_RPC_URL              Custom RPC URL for Base
 *   MOR_BASE_URL             Custom API base URL
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { startInteractiveChat } from '../src/cli/chat.js'
import { MorDiemSDK, deriveWallet, generateNewMnemonic, isValidMnemonic } from '../src/index.js'

// =============================================================================
// Config File Management
// =============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.mor-diem')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

interface MorDiemConfig {
	mnemonic?: string
	walletIndex?: number
	apiKey?: string
	mode?: 'p2p' | 'gateway'
}

function loadConfig(): MorDiemConfig {
	try {
		if (fs.existsSync(CONFIG_FILE)) {
			return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
		}
	} catch {
		// Ignore errors, return empty config
	}
	return {}
}

function saveConfig(config: MorDiemConfig): void {
	if (!fs.existsSync(CONFIG_DIR)) {
		fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
	}
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
}

// =============================================================================
// ANSI Colors
// =============================================================================

const c = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	bold: '\x1b[1m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	magenta: '\x1b[35m',
	gray: '\x1b[90m',
	red: '\x1b[31m',
}

// =============================================================================
// Onboarding Flow
// =============================================================================

async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

async function runOnboarding(): Promise<MorDiemConfig | null> {
	console.clear()
	console.log(`
${c.cyan}╭─────────────────────────────────────────────────────────────────╮${c.reset}
${c.cyan}│${c.reset}  ${c.bold}Welcome to MOR DIEM${c.reset}                                          ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  ${c.dim}Decentralized AI inference on Morpheus${c.reset}                       ${c.cyan}│${c.reset}
${c.cyan}╰─────────────────────────────────────────────────────────────────╯${c.reset}

No configuration found. Let's get you set up.

${c.yellow}How would you like to access Morpheus?${c.reset}

  ${c.green}[1]${c.reset} Generate new wallet ${c.dim}(true decentralization)${c.reset}
      → Creates HD wallet, you deposit MOR tokens
      → Requires: ~$3 worth of ETH + MOR on Base

  ${c.green}[2]${c.reset} Import existing wallet ${c.dim}(12 or 24 word seed)${c.reset}
      → Use your existing crypto wallet
      → For users who already have MOR tokens

  ${c.green}[3]${c.reset} Use hosted gateway ${c.dim}(easiest)${c.reset}
      → Get API key from api.mor.org
      → No wallet or tokens needed
      → Less decentralized, but works immediately

  ${c.green}[4]${c.reset} Learn about MOR DIEM first

  ${c.green}[5]${c.reset} Skip for now ${c.dim}(exit)${c.reset}
`)

	const choice = await prompt(`${c.cyan}Enter choice [1-5]:${c.reset} `)

	switch (choice) {
		case '1':
			return await onboardGenerateWallet()
		case '2':
			return await onboardImportWallet()
		case '3':
			return await onboardGateway()
		case '4':
			await showLearnContent()
			return await runOnboarding() // Show menu again after learning
		case '5':
			console.log(`\n${c.dim}Exiting. Run 'mor-diem' again when ready.${c.reset}\n`)
			return null
		default:
			console.log(`\n${c.red}Invalid choice. Please enter 1-5.${c.reset}`)
			return await runOnboarding()
	}
}

async function onboardGenerateWallet(): Promise<MorDiemConfig> {
	console.log(`\n${c.cyan}Generating new wallet...${c.reset}\n`)

	const mnemonic = generateNewMnemonic(128) // 12 words
	const wallet = deriveWallet(mnemonic, 0)
	const words = mnemonic.split(' ')

	console.log(
		`${c.yellow}╭─────────────────────────────────────────────────────────────────╮${c.reset}`,
	)
	console.log(
		`${c.yellow}│${c.reset}  ${c.bold}⚠️  SAVE THIS SEED PHRASE SECURELY${c.reset}                            ${c.yellow}│${c.reset}`,
	)
	console.log(
		`${c.yellow}│${c.reset}  ${c.dim}Anyone with these words can access your funds${c.reset}                  ${c.yellow}│${c.reset}`,
	)
	console.log(
		`${c.yellow}├─────────────────────────────────────────────────────────────────┤${c.reset}`,
	)

	for (let i = 0; i < words.length; i += 4) {
		const line = words
			.slice(i, i + 4)
			.map(
				(w, j) => `${c.green}${(i + j + 1).toString().padStart(2, ' ')}.${c.reset} ${w.padEnd(10)}`,
			)
			.join(' ')
		console.log(`${c.yellow}│${c.reset}  ${line}  ${c.yellow}│${c.reset}`)
	}

	console.log(
		`${c.yellow}├─────────────────────────────────────────────────────────────────┤${c.reset}`,
	)
	console.log(
		`${c.yellow}│${c.reset}  ${c.cyan}Address:${c.reset} ${wallet.address}  ${c.yellow}│${c.reset}`,
	)
	console.log(
		`${c.yellow}╰─────────────────────────────────────────────────────────────────╯${c.reset}`,
	)

	console.log(`
${c.yellow}To start chatting, you'll need to fund this wallet:${c.reset}

  ${c.green}1.${c.reset} Send ~0.01 ETH to the address above ${c.dim}(for gas on Base)${c.reset}
     Bridge from Ethereum: ${c.cyan}https://bridge.base.org${c.reset}

  ${c.green}2.${c.reset} Get ~5 MOR tokens ${c.dim}(minimum deposit for sessions)${c.reset}
     Swap ETH→MOR: ${c.cyan}https://app.uniswap.org${c.reset} ${c.dim}(select Base network)${c.reset}
     Current price: ~$0.57/MOR → ~$3 total

  ${c.green}3.${c.reset} Your MOR is a ${c.bold}refundable deposit${c.reset}, not a payment
     Tokens lock for 7 days per model, then ${c.green}return to you${c.reset}.
`)

	const save = await prompt(`${c.cyan}Save configuration to ~/.mor-diem/config? [Y/n]:${c.reset} `)

	if (save.toLowerCase() !== 'n') {
		const config: MorDiemConfig = {
			mnemonic,
			walletIndex: 0,
			mode: 'p2p',
		}
		saveConfig(config)
		console.log(`\n${c.green}✓ Configuration saved to ~/.mor-diem/config${c.reset}`)
		console.log(`${c.dim}  (File is readable only by you)${c.reset}\n`)
		return config
	}

	// If not saving, at least set in environment for this session
	process.env.MOR_MNEMONIC = mnemonic
	console.log(`\n${c.yellow}Configuration not saved. Set this for future sessions:${c.reset}`)
	console.log(`${c.dim}export MOR_MNEMONIC="${mnemonic}"${c.reset}\n`)

	return { mnemonic, walletIndex: 0, mode: 'p2p' }
}

async function onboardImportWallet(): Promise<MorDiemConfig | null> {
	console.log(`\n${c.cyan}Import existing wallet${c.reset}\n`)
	console.log(
		`${c.dim}Enter your 12 or 24 word seed phrase (words separated by spaces):${c.reset}\n`,
	)

	const mnemonic = await prompt(`${c.cyan}Seed phrase:${c.reset} `)

	if (!isValidMnemonic(mnemonic)) {
		console.log(`\n${c.red}Invalid seed phrase. Please check and try again.${c.reset}\n`)
		return await runOnboarding()
	}

	const wallet = deriveWallet(mnemonic, 0)
	console.log(`\n${c.green}✓ Valid seed phrase${c.reset}`)
	console.log(`  ${c.cyan}Address:${c.reset} ${wallet.address}\n`)

	const save = await prompt(`${c.cyan}Save configuration to ~/.mor-diem/config? [Y/n]:${c.reset} `)

	if (save.toLowerCase() !== 'n') {
		const config: MorDiemConfig = {
			mnemonic,
			walletIndex: 0,
			mode: 'p2p',
		}
		saveConfig(config)
		console.log(`\n${c.green}✓ Configuration saved${c.reset}\n`)
		return config
	}

	process.env.MOR_MNEMONIC = mnemonic
	return { mnemonic, walletIndex: 0, mode: 'p2p' }
}

async function onboardGateway(): Promise<MorDiemConfig | null> {
	console.log(`
${c.cyan}Gateway Mode${c.reset}

Gateway mode uses the hosted Morpheus API. You'll need an API key
from ${c.cyan}https://api.mor.org${c.reset} (or another compatible gateway).

${c.dim}This is the easiest way to get started - no wallet, no tokens,
no blockchain transactions. Just an API key like OpenAI.${c.reset}
`)

	const apiKey = await prompt(`${c.cyan}Enter your API key (or press Enter to skip):${c.reset} `)

	if (!apiKey) {
		console.log(`\n${c.yellow}No API key provided. Returning to menu...${c.reset}\n`)
		return await runOnboarding()
	}

	const save = await prompt(`${c.cyan}Save configuration to ~/.mor-diem/config? [Y/n]:${c.reset} `)

	if (save.toLowerCase() !== 'n') {
		const config: MorDiemConfig = {
			apiKey,
			mode: 'gateway',
		}
		saveConfig(config)
		console.log(`\n${c.green}✓ Configuration saved${c.reset}\n`)
		return config
	}

	process.env.MOR_API_KEY = apiKey
	return { apiKey, mode: 'gateway' }
}

async function showLearnContent(): Promise<void> {
	console.clear()
	console.log(`
${c.cyan}${c.bold}What is MOR DIEM?${c.reset}

MOR DIEM provides access to decentralized AI inference through
the Morpheus network.

${c.yellow}How it differs from OpenAI/Anthropic:${c.reset}

  ┌─────────────────────────────────────────────────────────────┐
  │  ${c.bold}Traditional API${c.reset}                                           │
  │  Pay $$ per token → Money is ${c.red}gone${c.reset}                          │
  │                                                             │
  │  ${c.bold}MOR DIEM${c.reset}                                                  │
  │  Deposit MOR tokens → Use unlimited → MOR ${c.green}returned${c.reset}        │
  │  (This is a refundable deposit, not a payment)              │
  └─────────────────────────────────────────────────────────────┘

${c.yellow}The Economics:${c.reset}

  • Deposit ~2 MOR per model (~$1.14 at current prices)
  • Get unlimited inference for 7 days
  • After 7 days, your MOR is returned automatically
  • You ${c.bold}own${c.reset} your tokens the whole time

${c.yellow}What you need to get started:${c.reset}

  • ~0.01 ETH on Base chain (for gas fees, ~$0.02)
  • ~5 MOR tokens minimum (for session deposits, ~$3)
  • Or: just an API key if using gateway mode

${c.dim}Press Enter to continue...${c.reset}
`)

	await prompt('')
}

// =============================================================================
// Config from Environment + File
// =============================================================================

// Load from file first, then override with env vars
const fileConfig = loadConfig()

const config = {
	apiKey: process.env.MOR_API_KEY || fileConfig.apiKey,
	mnemonic: process.env.MOR_MNEMONIC || fileConfig.mnemonic,
	walletIndex: Number.parseInt(
		process.env.MOR_WALLET_INDEX || String(fileConfig.walletIndex ?? 0),
		10,
	),
	rpcUrl: process.env.MOR_RPC_URL,
	baseUrl: process.env.MOR_BASE_URL,
	mode: fileConfig.mode,
}

function isConfigured(): boolean {
	return !!(config.mnemonic || config.apiKey)
}

// =============================================================================
// Helpers
// =============================================================================

function printHelp() {
	console.log(`
${c.cyan}♾️  MOR DIEM CLI${c.reset} - Morpheus Decentralized Inference

${c.yellow}GETTING STARTED:${c.reset}

  ${c.green}setup${c.reset}                       Guided first-time setup
  ${c.green}chat${c.reset}                        Interactive chat (runs setup if needed)

${c.yellow}WALLET COMMANDS:${c.reset}

  wallet generate           Generate new 12-word seed phrase
  wallet derive [index]     Show address for wallet index (default: 0)
  wallet balance            Show MOR, ETH, USDC balances
  wallet approve [amount]   Approve MOR for Diamond contract

${c.yellow}INFERENCE COMMANDS:${c.reset}

  chat                      Interactive chat mode with memory
  models                    List available models
  complete <message>        Quick inference test
  health                    Check API health

${c.yellow}CONFIGURATION:${c.reset}

  Config file: ${c.dim}~/.mor-diem/config${c.reset}

  Environment variables (override config file):
    MOR_API_KEY             API key for gateway mode
    MOR_MNEMONIC            BIP39 seed phrase (12 or 24 words)
    MOR_WALLET_INDEX        Wallet derivation index (default: 0)
    MOR_RPC_URL             Custom RPC for Base
    MOR_BASE_URL            Custom API base URL

${c.yellow}EXAMPLES:${c.reset}

  ${c.dim}# First time? Just run:${c.reset}
  mor-diem

  ${c.dim}# Generate a new wallet${c.reset}
  mor-diem wallet generate

  ${c.dim}# Interactive chat${c.reset}
  mor-diem chat

  ${c.dim}# Quick inference test${c.reset}
  mor-diem complete "Hello, world!"
`)
}

function requireMnemonic(): string {
	if (!config.mnemonic) {
		console.error('❌ MOR_MNEMONIC environment variable is required')
		console.error('   Set it with: export MOR_MNEMONIC="word1 word2 ..."')
		process.exit(1)
	}
	if (!isValidMnemonic(config.mnemonic)) {
		console.error('❌ Invalid mnemonic in MOR_MNEMONIC')
		process.exit(1)
	}
	return config.mnemonic
}

function createSDK(): MorDiemSDK {
	return new MorDiemSDK({
		mnemonic: config.mnemonic,
		walletIndex: config.walletIndex,
		rpcUrl: config.rpcUrl,
		proxyUrl: config.baseUrl, // proxy URL for P2P mode
	})
}

// =============================================================================
// Wallet Commands
// =============================================================================

async function cmdWalletGenerate() {
	console.log('\n🔐 Generating new BIP39 mnemonic...\n')

	const mnemonic = generateNewMnemonic(128) // 12 words
	const wallet = deriveWallet(mnemonic, 0)

	console.log('╔══════════════════════════════════════════════════════════════════╗')
	console.log('║  ⚠️  SAVE THIS MNEMONIC - IT WILL NOT BE SHOWN AGAIN            ║')
	console.log('╠══════════════════════════════════════════════════════════════════╣')
	console.log('║                                                                  ║')

	const words = mnemonic.split(' ')
	for (let i = 0; i < words.length; i += 4) {
		const line = words
			.slice(i, i + 4)
			.map((w, j) => `${(i + j + 1).toString().padStart(2, ' ')}. ${w.padEnd(10, ' ')}`)
			.join(' ')
		console.log(`║  ${line.padEnd(64, ' ')}║`)
	}

	console.log('║                                                                  ║')
	console.log('╠══════════════════════════════════════════════════════════════════╣')
	console.log(`║  Address (index 0): ${wallet.address}  ║`)
	console.log('║                                                                  ║')
	console.log('║  Next steps:                                                     ║')
	console.log('║  1. Save this mnemonic securely (password manager, paper, etc.)  ║')
	console.log('║  2. Set: export MOR_MNEMONIC="word1 word2 ..."                   ║')
	console.log('║  3. Send ETH to the address above for gas                        ║')
	console.log('║  4. Get MOR tokens (swap or purchase)                            ║')
	console.log('╚══════════════════════════════════════════════════════════════════╝')
	console.log('')
}

async function cmdWalletDerive(indexArg?: string) {
	const mnemonic = requireMnemonic()
	const index = indexArg ? Number.parseInt(indexArg, 10) : config.walletIndex

	if (Number.isNaN(index) || index < 0) {
		console.error('❌ Invalid index. Must be a non-negative integer.')
		process.exit(1)
	}

	const wallet = deriveWallet(mnemonic, index)

	console.log(`\n📍 Wallet at index ${index}\n`)
	console.log(`   Address:         ${wallet.address}`)
	console.log(`   Derivation Path: ${wallet.derivationPath}`)
	console.log(`   Public Key:      ${wallet.publicKey.slice(0, 20)}...`)
	console.log('')
}

async function cmdWalletBalance() {
	const mnemonic = requireMnemonic()
	const sdk = new MorDiemSDK({
		mnemonic,
		walletIndex: config.walletIndex,
		rpcUrl: config.rpcUrl,
	})

	console.log(`\n💰 Balances for ${sdk.address}\n`)

	try {
		const balances = await sdk.getBalances()
		console.log(`   ETH:  ${balances.ethFormatted}`)
		console.log(`   MOR:  ${balances.morFormatted}`)
		console.log(`   USDC: ${balances.usdcFormatted}`)
		console.log('')
		console.log(
			`   MOR Allowance (Diamond): ${balances.isUnlimitedAllowance ? 'unlimited' : balances.morAllowanceFormatted}`,
		)
		console.log('')
	} catch (e) {
		console.error(`\n❌ Error: ${e instanceof Error ? e.message : String(e)}`)
		process.exit(1)
	}
}

async function cmdWalletApprove(amountArg?: string) {
	const mnemonic = requireMnemonic()
	const sdk = new MorDiemSDK({
		mnemonic,
		walletIndex: config.walletIndex,
		rpcUrl: config.rpcUrl,
	})

	const displayAmount = amountArg || 'unlimited'
	console.log('\n🔓 Approving MOR for Morpheus Diamond contract...')
	console.log(`   Amount: ${displayAmount}`)
	console.log(`   From:   ${sdk.address}\n`)

	try {
		const result = await sdk.approveMor(amountArg ? BigInt(amountArg) : undefined)
		console.log('   ✅ Approved')
		console.log(`   Tx: ${result.txHash}`)
		console.log('')
	} catch (e) {
		console.error(`\n❌ Error: ${e instanceof Error ? e.message : String(e)}`)
		process.exit(1)
	}
}

// =============================================================================
// Inference Commands
// =============================================================================

async function cmdModels() {
	const sdk = createSDK()

	console.log(`\n📋 Available Models (${sdk.mode} mode)\n`)

	try {
		const models = await sdk.listModels()
		for (const model of models.data) {
			console.log(`   • ${model.id}`)
		}
		console.log('')
	} catch (e) {
		console.error(`\n❌ Error: ${e instanceof Error ? e.message : String(e)}`)
		process.exit(1)
	}
}

async function cmdComplete(message: string) {
	if (!message) {
		console.error('❌ Message is required')
		console.error('   Usage: mor-diem complete "Your message here"')
		process.exit(1)
	}

	const sdk = createSDK()

	console.log(`\n🤖 Completing with ${sdk.mode} mode...\n`)

	try {
		const response = await sdk.complete(message)
		console.log('Response:\n')
		console.log(response)
		console.log('')
	} catch (e) {
		console.error(`\n❌ Error: ${e instanceof Error ? e.message : String(e)}`)
		process.exit(1)
	}
}

async function cmdHealth() {
	const sdk = createSDK()

	console.log('\n🏥 Health Check\n')

	const result = await sdk.healthCheck()

	console.log(`   Mode:     ${result.mode}`)
	console.log(`   Base URL: ${result.baseUrl}`)
	console.log(`   Status:   ${result.ok ? '✅ OK' : '❌ Error'}`)
	if (result.error) {
		console.log(`   Error:    ${result.error}`)
	}
	console.log('')

	process.exit(result.ok ? 0 : 1)
}

// =============================================================================
// Main
// =============================================================================

const [, , command, ...args] = process.argv

// Helper to ensure configured before certain commands
async function ensureConfigured(): Promise<void> {
	if (!isConfigured()) {
		const newConfig = await runOnboarding()
		if (!newConfig) {
			process.exit(0)
		}
		// Update runtime config with onboarding results
		if (newConfig.mnemonic) config.mnemonic = newConfig.mnemonic
		if (newConfig.apiKey) config.apiKey = newConfig.apiKey
		if (newConfig.walletIndex !== undefined) config.walletIndex = newConfig.walletIndex
		if (newConfig.mode) config.mode = newConfig.mode
	}
}

switch (command) {
	case 'wallet':
		switch (args[0]) {
			case 'generate':
				await cmdWalletGenerate()
				break
			case 'derive':
				await cmdWalletDerive(args[1])
				break
			case 'balance':
				await cmdWalletBalance()
				break
			case 'approve':
				await cmdWalletApprove(args[1])
				break
			default:
				console.error(`❌ Unknown wallet command: ${args[0]}`)
				console.error('   Available: generate, derive, balance, approve')
				process.exit(1)
		}
		break

	case 'chat':
		await ensureConfigured()
		await startInteractiveChat({
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			rpcUrl: config.rpcUrl,
		})
		break

	case 'models':
		await cmdModels()
		break

	case 'complete':
		await cmdComplete(args.join(' '))
		break

	case 'health':
		await cmdHealth()
		break

	case 'setup': {
		// Explicit setup command - always run onboarding
		const setupConfig = await runOnboarding()
		if (setupConfig) {
			console.log(`${c.green}Setup complete!${c.reset} Run 'mor-diem chat' to start chatting.\n`)
		}
		break
	}

	case 'help':
	case '--help':
	case '-h':
		printHelp()
		break

	case undefined:
		// No command - if not configured, run onboarding; otherwise show help
		if (!isConfigured()) {
			await ensureConfigured()
			// After onboarding, start chat
			await startInteractiveChat({
				apiKey: config.apiKey,
				baseUrl: config.baseUrl,
				rpcUrl: config.rpcUrl,
			})
		} else {
			printHelp()
		}
		break

	default:
		console.error(`❌ Unknown command: ${command}`)
		printHelp()
		process.exit(1)
}
