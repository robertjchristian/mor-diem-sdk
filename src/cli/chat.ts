/**
 * MOR DIEM Interactive CLI
 *
 * Claude Code-style interactive experience with:
 * - Main menu with guided onboarding
 * - Wallet metrics display (balance, staking, session info)
 * - Educational content about MOR ecosystem
 * - Streaming responses with thinking display
 * - Memory management with auto-compaction
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { type ChatMessage, MorpheusClient } from '../client/index.js'
import {
	type Balances,
	deriveWalletFromMnemonic,
	getBalances,
	isValidMnemonic,
} from '../wallet/wallet.js'

// =============================================================================
// Cookie Auth Helper
// =============================================================================

function getRouterAuthHeader(): string {
	// Try cookie path from env, then local bin/morpheus, then home dir
	const cookiePaths = [
		process.env.MORPHEUS_COOKIE_PATH,
		path.join(process.cwd(), 'bin', 'morpheus', '.cookie'),
		path.join(process.env.HOME || '', '.morpheus', '.cookie'),
	].filter(Boolean) as string[]

	for (const cookiePath of cookiePaths) {
		try {
			if (fs.existsSync(cookiePath)) {
				const cookie = fs.readFileSync(cookiePath, 'utf-8').trim()
				return `Basic ${Buffer.from(cookie).toString('base64')}`
			}
		} catch {
			// Try next path
		}
	}

	// Fallback (won't work but better than crashing)
	console.warn('[chat] No cookie file found - router auth may fail')
	return ''
}

// =============================================================================
// Types
// =============================================================================

interface ModelConfig {
	id: string
	contextWindow: number
	compactAt: number
}

interface SessionInfo {
	modelId: string
	sessionId?: string
	startsAt?: number
	expiresAt?: number
	stakeMor?: string
}

interface ChatState {
	model: ModelConfig
	messages: ChatMessage[]
	tokenEstimate: number
	compactionCount: number
	systemPrompt: string | null
	wallet?: {
		address: string
		balances?: Balances
	}
	session?: SessionInfo
	// Toggle options
	showReasoning: boolean
	streamMode: boolean
	verbose: boolean
}

// =============================================================================
// Model Configurations
// =============================================================================

const MODEL_CONFIGS: Record<string, { contextWindow: number; description: string }> = {
	'kimi-k2.5': { contextWindow: 131072, description: 'General reasoning (default)' },
	'kimi-k2.5:web': { contextWindow: 131072, description: 'Web-search enabled' },
	'kimi-k2-thinking': { contextWindow: 131072, description: 'Extended reasoning' },
	'glm-4.7-flash': { contextWindow: 131072, description: 'Fast inference' },
	'glm-4.7': { contextWindow: 131072, description: 'Full reasoning model' },
	'glm-5': { contextWindow: 131072, description: 'Latest GLM model' },
	'hermes-4-14b': { contextWindow: 32768, description: 'Hermes instruct' },
	'gpt-oss-120b': { contextWindow: 131072, description: 'Open-source GPT' },
	'MiniMax-M2.5': { contextWindow: 131072, description: 'MiniMax model' },
}

const DEFAULT_CONTEXT_WINDOW = 32768
const COMPACT_THRESHOLD_RATIO = 0.7
const CHARS_PER_TOKEN = 4

// =============================================================================
// ANSI Colors & Formatting
// =============================================================================

const c = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	bold: '\x1b[1m',
	italic: '\x1b[3m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	magenta: '\x1b[35m',
	blue: '\x1b[34m',
	gray: '\x1b[90m',
	white: '\x1b[37m',
	red: '\x1b[31m',
	bgBlue: '\x1b[44m',
	bgGray: '\x1b[100m',
}

function box(title: string, content: string[], width = 60): string {
	const top = `╭${'─'.repeat(width - 2)}╮`
	const bottom = `╰${'─'.repeat(width - 2)}╯`
	const titleLine = `│ ${c.bold}${title}${c.reset}${' '.repeat(width - 4 - title.length)} │`
	const divider = `├${'─'.repeat(width - 2)}┤`
	const lines = content.map((line) => {
		const stripped = line.replace(/\x1b\[[0-9;]*m/g, '')
		const padding = Math.max(0, width - 4 - stripped.length)
		return `│ ${line}${' '.repeat(padding)} │`
	})
	return [top, titleLine, divider, ...lines, bottom].join('\n')
}

function formatTokens(tokens: number): string {
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
	return tokens.toString()
}

// =============================================================================
// Educational Content
// =============================================================================

const LEARN_CONTENT = {
	overview: `
${c.cyan}${c.bold}MOR DIEM SDK${c.reset}
${c.dim}Morpheus Decentralized Inference SDK${c.reset}

MOR DIEM provides access to decentralized AI inference through
the Morpheus network. Instead of paying per-token like traditional
APIs, you ${c.green}deposit MOR tokens${c.reset} to unlock inference sessions.

${c.yellow}Key Differences from Traditional APIs:${c.reset}
  • No per-token billing - deposit once, use unlimited
  • 7-day session windows - one deposit unlocks a full week
  • MOR tokens ${c.green}returned${c.reset} - this is a deposit, not a payment
  • Decentralized - no single point of failure

${c.cyan}Architecture:${c.reset}
  Your App → MOR DIEM SDK → morpheus-proxy → blockchain → AI providers
`,
	staking: `
${c.cyan}${c.bold}How MOR Staking Works${c.reset}

${c.yellow}Think: Refundable Deposit, Not Payment${c.reset}

  ┌────────────────────────────────────────────────────────┐
  │  This is NOT like paying for a subscription.           │
  │                                                        │
  │  Your MOR is a ${c.green}refundable security deposit${c.reset}.          │
  │  Lock it → get access → get it back.                   │
  │                                                        │
  │  You ${c.bold}own${c.reset} your tokens the whole time.                  │
  │  They generate access, then return to you.             │
  └────────────────────────────────────────────────────────┘

${c.yellow}One Session Per Model:${c.reset}
  Each AI model requires its ${c.bold}own session${c.reset} with its provider.
  Use 5 models? That's 5 sessions with 5 separate deposits.
  The SDK opens sessions automatically when you chat.

${c.yellow}The Flow:${c.reset}
  1. ${c.green}Approve${c.reset} - Allow Diamond contract to use your MOR
  2. ${c.green}Deposit${c.reset} - Lock ~2 MOR per model for 7 days
  3. ${c.green}Use${c.reset} - Unlimited inference during session
  4. ${c.green}Release${c.reset} - MOR returned to your wallet

${c.yellow}Economics:${c.reset}
  • Deposit per session: ${c.green}~2 MOR${c.reset} (varies by provider)
  • Session duration: ${c.green}7 days${c.reset}
  • Gas: ~0.0001 ETH per session (Base chain)

${c.yellow}Usage Limits (Pro-Rata Model):${c.reset}
  The network has a ${c.green}daily compute budget${c.reset} (~24k MOR).
  Your share = (Your Staked MOR ÷ Total Network Stake) × Daily Budget

  ${c.dim}In practice: sessions appear unlimited for typical use.
  Heavy users may hit pro-rata limits (exact enforcement unclear).${c.reset}

${c.cyan}Your MOR is DEPOSITED, not SPENT.${c.reset}
Tokens are locked temporarily, then returned automatically.
Use /budget to check network compute budget.
`,
	diem: `
${c.cyan}${c.bold}What is MOR DIEM?${c.reset}

DIEM = ${c.green}Decentralized Inference Execution Model${c.reset}

MOR DIEM is like an ${c.green}annuity for AI access${c.reset}:
  • You own the MOR tokens
  • They generate inference access
  • You keep the principal

${c.yellow}Core Concepts:${c.reset}
  • ${c.green}Sessions${c.reset} - Time-bound access windows (7 days default)
  • ${c.green}Deposits${c.reset} - MOR tokens locked as refundable collateral
  • ${c.green}Epochs${c.reset} - Network coordination periods
  • ${c.green}Providers${c.reset} - Decentralized compute nodes

${c.yellow}The Economic Model:${c.reset}

  ┌─────────────────────────────────────────────────────────┐
  │  Traditional API:  Pay $$ → Use → $$ is gone            │
  │                                                         │
  │  MOR DIEM:         Deposit MOR → Use → MOR returned     │
  │                    (you keep your tokens)               │
  └─────────────────────────────────────────────────────────┘

${c.cyan}Your MOR generates access, then comes back to you.${c.reset}
`,
	epochs: `
${c.cyan}${c.bold}How Epochs Work${c.reset}

The Morpheus network operates in discrete ${c.green}epochs${c.reset} - time
periods that coordinate provider availability and pricing.

${c.yellow}Epoch Functions:${c.reset}
  • Define provider ${c.green}availability${c.reset} for each model
  • Set ${c.green}pricing tiers${c.reset} (LIGHT, STANDARD, HEAVY)
  • Update ${c.green}model registries${c.reset} on-chain
  • Coordinate ${c.green}provider bids${c.reset}

${c.yellow}Model Categories:${c.reset}
  LIGHT    - Fast, efficient models (glm-4.7-flash)
  STANDARD - General purpose (kimi-k2.5, llama-3.3)
  HEAVY    - Large models (qwen3-235b, gpt-oss-120b)

${c.yellow}Dynamic Updates:${c.reset}
  The proxy refreshes model mappings every 5 minutes from
  the blockchain, picking up new models as they register.

${c.cyan}Epochs ensure fair provider compensation and reliable service.${c.reset}
`,
	wallet: `
${c.cyan}${c.bold}Wallet Setup & Security${c.reset}

${c.yellow}Where Keys Are Stored:${c.reset}
  Your wallet credentials are stored in environment variables:

  ${c.green}MOR_MNEMONIC${c.reset}      - 12 or 24 word seed phrase
  ${c.green}MOR_PRIVATE_KEY${c.reset}   - Alternative: raw private key
  ${c.green}MOR_WALLET_INDEX${c.reset}  - Derivation index (default: 0)

${c.yellow}How to Set Up:${c.reset}
  1. Generate mnemonic: ${c.dim}bun run cli wallet generate${c.reset}
  2. Export to env:     ${c.dim}export MOR_MNEMONIC="word1 word2 ..."${c.reset}
  3. Check balance:     ${c.dim}bun run cli wallet balance${c.reset}

${c.yellow}Funding Your Wallet:${c.reset}
  1. Get wallet address from CLI
  2. Send ETH to address (for gas, ~0.01 ETH)
  3. Send MOR to address (minimum 5 MOR for sessions)

  Buy MOR: Swap ETH/USDC on Uniswap (Arbitrum)
  Contract: ${c.dim}0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86${c.reset}

${c.red}NEVER commit your mnemonic or private key to git!${c.reset}
${c.red}NEVER share your seed phrase with anyone!${c.reset}
`,
	models: `
${c.cyan}${c.bold}Available Models${c.reset}

${c.yellow}Reasoning Models:${c.reset}
  ${c.green}kimi-k2.5${c.reset}          - General reasoning (recommended)
  ${c.green}kimi-k2.5:web${c.reset}      - Web search enabled
  ${c.green}kimi-k2-thinking${c.reset}   - Extended reasoning with thinking

${c.yellow}Fast Models:${c.reset}
  ${c.green}glm-4.7-flash${c.reset}      - Quick responses, lower latency
  ${c.green}glm-4.7${c.reset}            - Full GLM reasoning

${c.yellow}Large Models:${c.reset}
  ${c.green}qwen3-235b${c.reset}         - 235B params, multilingual
  ${c.green}llama-3.3-70b${c.reset}      - Meta's Llama 3.3
  ${c.green}gpt-oss-120b${c.reset}       - Open-source GPT variant

${c.yellow}Context Windows:${c.reset}
  All models support ${c.green}128k tokens${c.reset} context

${c.yellow}Switching Models:${c.reset}
  Use ${c.green}/model${c.reset} in chat to switch between models.
  Memory is preserved when switching.
`,
}

// =============================================================================
// Slash Commands
// =============================================================================

interface SlashCommand {
	description: string
	handler: (
		state: ChatState,
		client: MorpheusClient,
		args: string,
		rl: readline.Interface,
	) => Promise<boolean>
}

const SLASH_COMMANDS: Record<string, SlashCommand> = {
	help: {
		description: 'Show available commands',
		handler: async () => {
			console.log(`\n${c.cyan}${c.bold}Commands${c.reset}\n`)
			console.log(`${c.dim}Chat Commands:${c.reset}`)
			console.log(`  ${c.green}/model${c.reset}      Change the active model`)
			console.log(`  ${c.green}/system${c.reset}     Set system prompt`)
			console.log(`  ${c.green}/clear${c.reset}      Clear conversation history`)
			console.log(`  ${c.green}/compact${c.reset}    Force memory compaction`)
			console.log(`  ${c.green}/history${c.reset}    Show conversation history`)
			console.log(`  ${c.green}/toggle${c.reset}     Toggle options (reasoning, verbose)`)
			console.log('')
			console.log(`${c.dim}Info Commands:${c.reset}`)
			console.log(`  ${c.green}/status${c.reset}     Show session & wallet metrics`)
			console.log(`  ${c.green}/wallet${c.reset}     Show wallet balance`)
			console.log(`  ${c.green}/budget${c.reset}     Show network compute budget`)
			console.log(`  ${c.green}/learn${c.reset}      Learn about MOR ecosystem`)
			console.log('')
			console.log(`${c.dim}Navigation:${c.reset}`)
			console.log(`  ${c.green}/menu${c.reset}       Return to main menu`)
			console.log(`  ${c.green}/exit${c.reset}       Exit the CLI (or Ctrl+C)`)
			console.log('')
			return true
		},
	},
	status: {
		description: 'Show session & wallet metrics',
		handler: async (state) => {
			await printMetrics(state)
			return true
		},
	},
	wallet: {
		description: 'Show wallet balance',
		handler: async (state) => {
			await refreshWalletBalance(state)
			return true
		},
	},
	budget: {
		description: 'Show network compute budget',
		handler: async () => {
			const routerUrl = process.env.MORPHEUS_ROUTER_URL || 'http://localhost:8082'
			const authHeader = getRouterAuthHeader()

			console.log(`\n${c.cyan}Fetching network budget...${c.reset}`)

			try {
				const resp = await fetch(`${routerUrl}/blockchain/sessions/budget`, {
					headers: { Authorization: authHeader },
				})
				if (!resp.ok) {
					console.log(
						`${c.yellow}Could not fetch budget (router returned ${resp.status})${c.reset}\n`,
					)
					return true
				}
				const data = (await resp.json()) as { budget: string }
				const budgetMor = (Number(data.budget) / 1e18).toFixed(2)

				console.log(`\n${c.cyan}${c.bold}Network Compute Budget${c.reset}\n`)
				console.log(`  ${c.green}Today's Budget:${c.reset} ${budgetMor} MOR`)
				console.log(`  ${c.dim}(Total compute budget for all users today)${c.reset}`)
				console.log('')
				console.log(`${c.yellow}Pro-Rata Model:${c.reset}`)
				console.log('  Your share = (Your Staked MOR ÷ Total Staked) × Daily Budget')
				console.log(
					`  ${c.dim}Example: 10 MOR staked with 10M total = 0.0001% = ~0.024 MOR/day${c.reset}`,
				)
				console.log('')
				console.log(`${c.dim}Note: Per-user budget tracking not exposed by router API.${c.reset}`)
				console.log(`${c.dim}In practice, sessions appear unlimited for typical use.${c.reset}\n`)
			} catch (e) {
				console.log(
					`\n${c.yellow}Could not fetch budget: ${e instanceof Error ? e.message : String(e)}${c.reset}`,
				)
				console.log(`${c.dim}Is the router running at ${routerUrl}?${c.reset}\n`)
			}
			return true
		},
	},
	clear: {
		description: 'Clear conversation history',
		handler: async (state) => {
			state.messages = state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : []
			state.tokenEstimate = estimateMessagesTokens(state.messages)
			console.log(`\n${c.yellow}Conversation cleared.${c.reset}\n`)
			return true
		},
	},
	compact: {
		description: 'Force conversation compaction',
		handler: async (state, client) => {
			if (state.messages.length < 4) {
				console.log(`\n${c.yellow}Not enough messages to compact.${c.reset}\n`)
				return true
			}
			console.log(`\n${c.cyan}Compacting conversation...${c.reset}`)
			state.messages = await compactConversation(client, state)
			state.tokenEstimate = estimateMessagesTokens(state.messages)
			state.compactionCount++
			await printMetrics(state)
			return true
		},
	},
	model: {
		description: 'Change the active model',
		handler: async (state, client, _args, rl) => {
			const newModel = await selectModel(client, rl, state.model.id)
			if (newModel) {
				const config = MODEL_CONFIGS[newModel] || { contextWindow: DEFAULT_CONTEXT_WINDOW }
				state.model = {
					id: newModel,
					contextWindow: config.contextWindow,
					compactAt: Math.floor(config.contextWindow * COMPACT_THRESHOLD_RATIO),
				}
				console.log(`\n${c.green}Switched to ${newModel}${c.reset}\n`)
			}
			return true
		},
	},
	system: {
		description: 'Set system prompt',
		handler: async (state, _client, args) => {
			if (!args.trim()) {
				if (state.systemPrompt) {
					console.log(`\n${c.cyan}Current system prompt:${c.reset}`)
					console.log(`${c.dim}${state.systemPrompt}${c.reset}\n`)
				} else {
					console.log(`\n${c.dim}No system prompt set. Use /system <prompt>${c.reset}\n`)
				}
				return true
			}
			state.systemPrompt = args.trim()
			if (state.messages.length > 0 && state.messages[0].role === 'system') {
				state.messages[0].content = state.systemPrompt
			} else {
				state.messages.unshift({ role: 'system', content: state.systemPrompt })
			}
			state.tokenEstimate = estimateMessagesTokens(state.messages)
			console.log(`\n${c.green}System prompt updated.${c.reset}\n`)
			return true
		},
	},
	history: {
		description: 'Show conversation history',
		handler: async (state) => {
			console.log(`\n${c.cyan}${c.bold}Conversation History${c.reset}\n`)
			if (state.messages.length === 0) {
				console.log(`${c.dim}No messages yet.${c.reset}\n`)
				return true
			}
			for (const msg of state.messages) {
				const roleColor =
					msg.role === 'user' ? c.green : msg.role === 'assistant' ? c.blue : c.magenta
				const preview = msg.content.length > 100 ? `${msg.content.slice(0, 100)}...` : msg.content
				console.log(`${roleColor}[${msg.role}]${c.reset} ${preview}`)
			}
			console.log('')
			return true
		},
	},
	learn: {
		description: 'Learn about MOR ecosystem',
		handler: async (_state, _client, _args, rl) => {
			await showLearnMenu(rl)
			return true
		},
	},
	menu: {
		description: 'Return to main menu',
		handler: async () => {
			return false // Signal to return to menu
		},
	},
	exit: {
		description: 'Exit the CLI',
		handler: async () => {
			console.log(`\n${c.dim}Goodbye!${c.reset}\n`)
			process.exit(0)
		},
	},
	quit: {
		description: 'Exit the CLI',
		handler: async () => {
			console.log(`\n${c.dim}Goodbye!${c.reset}\n`)
			process.exit(0)
		},
	},
	toggle: {
		description: 'Toggle CLI options',
		handler: async (state, _client, args) => {
			const option = args.trim().toLowerCase()

			if (!option) {
				// Show current toggles
				const on = `${c.green}ON${c.reset}`
				const off = `${c.dim}off${c.reset}`
				console.log(`\n${c.cyan}${c.bold}Toggle Options${c.reset}\n`)
				console.log(
					`  ${c.green}reasoning${c.reset}  ${state.showReasoning ? on : off}  - Show AI thinking process`,
				)
				console.log(
					`  ${c.green}stream${c.reset}     ${state.streamMode ? on : off}  - Stream responses (vs batch)`,
				)
				console.log(
					`  ${c.green}verbose${c.reset}    ${state.verbose ? on : off}  - Verbose output`,
				)
				console.log(`\n${c.dim}Usage: /toggle <option>${c.reset}\n`)
				return true
			}

			switch (option) {
				case 'reasoning':
				case 'think':
				case 'thinking':
					state.showReasoning = !state.showReasoning
					console.log(
						`\n${c.green}Reasoning display: ${state.showReasoning ? 'ON' : 'OFF'}${c.reset}\n`,
					)
					break
				case 'stream':
				case 'streaming':
					state.streamMode = !state.streamMode
					console.log(`\n${c.green}Streaming mode: ${state.streamMode ? 'ON' : 'OFF'}${c.reset}\n`)
					break
				case 'verbose':
				case 'v':
					state.verbose = !state.verbose
					console.log(`\n${c.green}Verbose mode: ${state.verbose ? 'ON' : 'OFF'}${c.reset}\n`)
					break
				default:
					console.log(
						`\n${c.yellow}Unknown toggle: ${option}. Options: reasoning, stream, verbose${c.reset}\n`,
					)
			}
			return true
		},
	},
}

// =============================================================================
// Token Estimation
// =============================================================================

function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function estimateMessagesTokens(messages: ChatMessage[]): number {
	let total = 0
	for (const msg of messages) {
		total += 4
		total += estimateTokens(msg.content)
	}
	return total
}

// =============================================================================
// Compaction
// =============================================================================

async function compactConversation(
	client: MorpheusClient,
	state: ChatState,
): Promise<ChatMessage[]> {
	if (state.messages.length < 4) return state.messages

	const systemMsg = state.messages[0]?.role === 'system' ? state.messages[0] : null
	const conversationMessages = systemMsg ? state.messages.slice(1) : state.messages
	const recentMessages = conversationMessages.slice(-4)
	const oldMessages = conversationMessages.slice(0, -4)

	if (oldMessages.length === 0) return state.messages

	const oldConversation = oldMessages
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join('\n\n')

	const summaryResponse = await client.complete(
		`Summarize this conversation concisely, preserving key facts and context:\n\n${oldConversation}`,
		{ model: state.model.id, maxTokens: 1000 },
	)

	const compactedMessages: ChatMessage[] = []
	if (systemMsg) compactedMessages.push(systemMsg)
	compactedMessages.push({
		role: 'system',
		content: `[Previous conversation summary: ${summaryResponse.trim()}]`,
	})
	compactedMessages.push(...recentMessages)

	return compactedMessages
}

// =============================================================================
// Wallet & Metrics
// =============================================================================

async function refreshWalletBalance(state: ChatState): Promise<void> {
	const mnemonic = process.env.MOR_MNEMONIC
	if (!mnemonic || !isValidMnemonic(mnemonic)) {
		console.log(`\n${c.yellow}No wallet configured.${c.reset}`)
		console.log(`${c.dim}Set MOR_MNEMONIC environment variable.${c.reset}\n`)
		return
	}

	const index = Number.parseInt(process.env.MOR_WALLET_INDEX || '0', 10)
	const wallet = deriveWalletFromMnemonic(mnemonic, index)
	const routerUrl = process.env.MORPHEUS_ROUTER_URL || 'http://localhost:8082'
	const authHeader = getRouterAuthHeader()

	console.log(`\n${c.cyan}Fetching wallet info...${c.reset}`)

	try {
		const balances = await getBalances({ mnemonic, walletIndex: index })
		state.wallet = { address: wallet.address, balances }

		// Format address shortened
		const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`

		// Fetch active sessions with stake info
		let totalStaked = 0n
		let sessions: Array<{
			Id: string
			ModelAgentId: string
			Stake: number
			EndsAt: number
			PricePerSecond: number
		}> = []

		try {
			// Get session IDs for user
			const userSessResp = await fetch(
				`${routerUrl}/blockchain/sessions/user?user=${wallet.address}&limit=50`,
				{ headers: { Authorization: authHeader } },
			)
			if (userSessResp.ok) {
				const data = (await userSessResp.json()) as { sessions: typeof sessions }
				sessions = data.sessions || []

				// For active sessions, sum up stakes
				const now = Date.now() / 1000
				for (const s of sessions) {
					if (s.EndsAt > now && s.Stake) {
						totalStaked += BigInt(s.Stake)
					}
				}
			}
		} catch {
			// Router might not be running
		}

		// Calculate balances
		const stakedMor = Number(totalStaked) / 1e18
		const walletMor = Number(balances.mor) / 1e18
		const walletEth = Number(balances.eth) / 1e18
		const activeSessions = sessions.filter((s) => s.EndsAt > Date.now() / 1000)

		const content = [
			`${c.dim}Address:${c.reset}     ${shortAddr}`,
			'',
			`${c.green}ETH${c.reset}          ${walletEth.toFixed(4)}`,
			`${c.green}MOR${c.reset}          ${walletMor.toFixed(2)} ${c.dim}(in wallet)${c.reset}`,
			`${c.yellow}Staked${c.reset}       ${stakedMor.toFixed(2)} ${c.dim}(${activeSessions.length} sessions)${c.reset}`,
			'',
			`${c.dim}Allowance:${c.reset}   ${balances.isUnlimitedAllowance ? `${c.red}Unlimited (BAD!)${c.reset}` : `${balances.morAllowanceFormatted} MOR`}`,
		]

		console.log(`\n${box('Wallet (Base Mainnet)', content)}`)

		// Show session details if any
		if (activeSessions.length > 0) {
			// Try to get model names from model registry
			const modelMap: Record<string, string> = {}
			try {
				const modelsResp = await fetch(`${routerUrl}/blockchain/models`, {
					headers: { Authorization: authHeader },
				})
				if (modelsResp.ok) {
					const data = (await modelsResp.json()) as {
						models: Array<{ Id: string; Name: string }>
					}
					for (const m of data.models || []) {
						modelMap[m.Id] = m.Name
					}
				}
			} catch {
				// Ignore
			}

			const sessionContent = activeSessions.map((s) => {
				const remaining = Math.max(0, s.EndsAt - Date.now() / 1000)
				const days = Math.floor(remaining / 86400)
				const hours = Math.floor((remaining % 86400) / 3600)
				const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`
				const stakeMor = (Number(s.Stake) / 1e18).toFixed(2)
				// Show model name if we can look it up, otherwise show shortened ID
				const modelName = modelMap[s.ModelAgentId] || s.ModelAgentId?.slice(0, 10) || 'unknown'
				return `${c.green}${modelName.padEnd(20)}${c.reset} ${c.yellow}${stakeMor} MOR${c.reset}  ${c.dim}${timeStr} left${c.reset}`
			})
			console.log(`\n${box('Active Stakes (unlimited usage per session)', sessionContent)}`)
		} else {
			console.log(`\n${c.dim}No active stakes. Start chatting to open a session.${c.reset}`)
		}

		console.log()
	} catch (e) {
		console.log(
			`\n${c.red}Error fetching balances: ${e instanceof Error ? e.message : String(e)}${c.reset}\n`,
		)
	}
}

async function showWalletMenu(rl: readline.Interface, state: ChatState): Promise<void> {
	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	const mnemonic = process.env.MOR_MNEMONIC
	if (!mnemonic || !isValidMnemonic(mnemonic)) {
		console.log(`\n${c.yellow}No wallet configured.${c.reset}`)
		console.log('Set MOR_MNEMONIC in your .env file.')
		await question(`\n${c.dim}Press Enter to continue...${c.reset}`)
		return
	}

	const routerUrl = process.env.MORPHEUS_ROUTER_URL || 'http://localhost:8082'
	const authHeader = getRouterAuthHeader()

	while (true) {
		console.log(`\n${c.cyan}${c.bold}Wallet Menu${c.reset}\n`)
		console.log(
			`  ${c.dim}1.${c.reset} ${c.green}Status${c.reset}      - Balances + active sessions`,
		)
		console.log(`  ${c.dim}2.${c.reset} ${c.green}Providers${c.reset}   - View network providers`)
		console.log(`  ${c.dim}3.${c.reset} ${c.green}Models${c.reset}      - View available models`)
		console.log(
			`  ${c.dim}4.${c.reset} ${c.green}Approve${c.reset}     - Approve 10k MOR for staking`,
		)
		console.log('')
		console.log(`  ${c.dim}0.${c.reset} Back`)
		console.log()

		const choice = await question(`${c.cyan}Select option${c.reset}: `)
		const num = Number.parseInt(choice.trim(), 10)

		switch (num) {
			case 0:
				return

			case 1:
				await refreshWalletBalance(state)
				break

			case 2:
				// Show providers
				try {
					const resp = await fetch(`${routerUrl}/blockchain/providers`, {
						headers: { Authorization: authHeader },
					})
					if (resp.ok) {
						const data = (await resp.json()) as {
							providers: Array<{ Address: string; Endpoint: string; Stake: string }>
						}
						const providerContent = data.providers.map((p) => {
							const stake = (Number(p.Stake) / 1e18).toFixed(0)
							return `${c.dim}${p.Address.slice(0, 10)}...${c.reset}  ${c.green}${stake} MOR${c.reset}  ${c.dim}${p.Endpoint}${c.reset}`
						})
						console.log(`\n${box(`Providers (${data.providers.length})`, providerContent)}`)
					}
				} catch {
					console.log(`\n${c.red}Could not fetch providers${c.reset}`)
				}
				break

			case 3:
				// Show models
				try {
					const resp = await fetch(`${routerUrl}/blockchain/models`, {
						headers: { Authorization: authHeader },
					})
					if (resp.ok) {
						const data = (await resp.json()) as {
							models: Array<{ Name: string; ModelType: string; Owner: string; Tags: string[] }>
						}
						const llmModels = data.models.filter((m) => m.ModelType === 'LLM')
						const otherModels = data.models.filter((m) => m.ModelType !== 'LLM')

						const modelContent = llmModels.slice(0, 15).map((m) => {
							const tags = m.Tags?.slice(0, 3).join(', ') || ''
							return `${c.green}${m.Name.padEnd(30)}${c.reset} ${c.dim}${tags}${c.reset}`
						})
						if (llmModels.length > 15) {
							modelContent.push(
								`${c.dim}... and ${llmModels.length - 15} more LLM models${c.reset}`,
							)
						}
						console.log(`\n${box(`LLM Models (${llmModels.length})`, modelContent)}`)

						if (otherModels.length > 0) {
							const otherContent = otherModels.map((m) => {
								return `${c.yellow}${m.Name.padEnd(30)}${c.reset} ${c.dim}${m.ModelType}${c.reset}`
							})
							console.log(`\n${box(`Other Models (${otherModels.length})`, otherContent)}`)
						}
					}
				} catch {
					console.log(`\n${c.red}Could not fetch models${c.reset}`)
				}
				break

			case 4:
				console.log(`\n${c.cyan}Approving MOR for Diamond contract via router...${c.reset}`)
				try {
					// IMPORTANT: Do NOT use MAX_UINT256 - causes overflow. Use 10000 MOR.
					const diamond = '0x6aBE1d282f72B474E54527D93b979A4f64d3030a'
					const amount = '10000000000000000000000' // 10000 MOR in wei

					const response = await fetch(
						`${routerUrl}/blockchain/approve?spender=${diamond}&amount=${amount}`,
						{ method: 'POST', headers: { Authorization: authHeader } },
					)

					if (!response.ok) {
						const err = await response.json().catch(() => ({}))
						throw new Error(err.error || `HTTP ${response.status}`)
					}

					const result = (await response.json()) as { tx: string }
					console.log(`\n${c.green}Approval successful!${c.reset}`)
					console.log(`${c.dim}Tx:${c.reset} ${result.tx}`)
					console.log(`${c.dim}Amount:${c.reset} 10,000 MOR`)
				} catch (e) {
					console.log(
						`\n${c.red}Approval failed: ${e instanceof Error ? e.message : String(e)}${c.reset}`,
					)
				}
				break

			default:
				console.log(`${c.yellow}Invalid option.${c.reset}`)
		}
	}
}

async function printMetrics(state: ChatState): Promise<void> {
	const usage = ((state.tokenEstimate / state.model.contextWindow) * 100).toFixed(1)
	const usageBar = createProgressBar(state.tokenEstimate, state.model.contextWindow, 20)

	const content = [
		`${c.dim}Model:${c.reset}       ${c.green}${state.model.id}${c.reset}`,
		`${c.dim}Messages:${c.reset}    ${state.messages.length}`,
		`${c.dim}Tokens:${c.reset}      ${formatTokens(state.tokenEstimate)} / ${formatTokens(state.model.contextWindow)}`,
		`${c.dim}Usage:${c.reset}       ${usageBar} ${usage}%`,
		`${c.dim}Compactions:${c.reset} ${state.compactionCount}`,
	]

	if (state.wallet?.balances) {
		content.push('')
		content.push(`${c.dim}Wallet:${c.reset}      ${state.wallet.address.slice(0, 10)}...`)
		content.push(`${c.dim}MOR:${c.reset}         ${state.wallet.balances.morFormatted}`)
		content.push(`${c.dim}ETH:${c.reset}         ${state.wallet.balances.ethFormatted}`)
	}

	console.log(`\n${box('Session Metrics', content)}\n`)
}

function createProgressBar(current: number, max: number, width: number): string {
	const ratio = Math.min(current / max, 1)
	const filled = Math.round(ratio * width)
	const empty = width - filled
	const color = ratio > 0.7 ? c.yellow : ratio > 0.9 ? c.red : c.green
	return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`
}

// =============================================================================
// Model Selection
// =============================================================================

async function selectModel(
	client: MorpheusClient,
	rl: readline.Interface,
	currentModel?: string,
): Promise<string | null> {
	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	console.log(`\n${c.cyan}Fetching models and sessions...${c.reset}`)

	interface ModelInfo {
		id?: string
		Id?: string
		Name?: string
		modelType?: string
		ModelType?: string
		Tags?: string[]
		PricePerSecond?: number
	}

	interface SessionInfo {
		ModelAgentId: string
		EndsAt: number
	}

	const routerUrl = process.env.MORPHEUS_ROUTER_URL || 'http://localhost:8082'
	const authHeader = getRouterAuthHeader()

	// Fetch all models from router
	let allModels: Array<{ name: string; id: string; tags: string; pricePerSecond: number }> = []
	try {
		const resp = await fetch(`${routerUrl}/blockchain/models`, {
			headers: { Authorization: authHeader },
		})
		if (resp.ok) {
			const data = (await resp.json()) as { models: ModelInfo[] }
			const llmModels = (data.models || []).filter((m) => m.ModelType === 'LLM')
			allModels = llmModels.map((m) => ({
				name: m.Name || m.id || 'unknown',
				id: m.Id || m.id || '',
				tags: m.Tags?.slice(0, 2).join(', ') || '',
				pricePerSecond: m.PricePerSecond || 0,
			}))
		}
	} catch {
		// Router not available
	}

	// Fallback to proxy/defaults if router unavailable
	if (allModels.length === 0) {
		try {
			const response = await client.listModels()
			allModels = response.data
				.filter(
					(m: ModelInfo) => m.modelType === 'LLM' || (!m.modelType && !m.id?.includes('embedding')),
				)
				.map((m: ModelInfo) => ({
					name: m.id || m.Name || 'unknown',
					id: '',
					tags: MODEL_CONFIGS[m.id || '']?.description || '',
					pricePerSecond: 0,
				}))
		} catch {
			allModels = Object.keys(MODEL_CONFIGS).map((name) => ({
				name,
				id: '',
				tags: MODEL_CONFIGS[name]?.description || '',
				pricePerSecond: 0,
			}))
		}
	}

	// Fetch active sessions to see which models have stakes
	const activeModelIds = new Set<string>()
	const mnemonic = process.env.MOR_MNEMONIC
	if (mnemonic && isValidMnemonic(mnemonic)) {
		try {
			const index = Number.parseInt(process.env.MOR_WALLET_INDEX || '0', 10)
			const wallet = deriveWalletFromMnemonic(mnemonic, index)
			const sessResp = await fetch(
				`${routerUrl}/blockchain/sessions/user?user=${wallet.address}&limit=50`,
				{ headers: { Authorization: authHeader } },
			)
			if (sessResp.ok) {
				const data = (await sessResp.json()) as { sessions: SessionInfo[] }
				const now = Date.now() / 1000
				for (const s of data.sessions || []) {
					if (s.EndsAt > now) {
						activeModelIds.add(s.ModelAgentId)
					}
				}
			}
		} catch {
			// Ignore
		}
	}

	// Display models with stake status
	console.log(`\n${c.cyan}${c.bold}Available Models (${allModels.length})${c.reset}`)
	console.log(`${c.dim}● = active session (staked)${c.reset}\n`)

	for (let i = 0; i < allModels.length; i++) {
		const m = allModels[i]
		const num = (i + 1).toString().padStart(2)
		const hasStake = activeModelIds.has(m.id)
		const stakeMarker = hasStake ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`
		const currentMarker = m.name === currentModel ? ` ${c.yellow}← current${c.reset}` : ''
		console.log(
			`  ${c.dim}${num}.${c.reset} ${stakeMarker} ${c.green}${m.name.padEnd(24)}${c.reset} ${c.dim}${m.tags}${c.reset}${currentMarker}`,
		)
	}

	const choice = await question(`\n${c.cyan}Select model${c.reset} (number or name): `)
	if (!choice.trim()) return null

	let selected: (typeof allModels)[0] | undefined
	const num = Number.parseInt(choice, 10)
	if (!Number.isNaN(num) && num >= 1 && num <= allModels.length) {
		selected = allModels[num - 1]
	} else {
		selected = allModels.find((m) => m.name.toLowerCase() === choice.trim().toLowerCase())
	}

	if (!selected) {
		console.log(`${c.yellow}Invalid selection.${c.reset}`)
		return null
	}

	// Check if model has active stake
	const hasStake = activeModelIds.has(selected.id)
	if (!hasStake && selected.id) {
		// Calculate estimated stake cost
		const sessionDuration = 604800 // 7 days
		const stakeMor =
			selected.pricePerSecond > 0
				? ((selected.pricePerSecond * sessionDuration) / 1e18).toFixed(2)
				: '~2'

		console.log(`\n${c.yellow}No active session for ${selected.name}${c.reset}`)
		console.log(
			`${c.dim}Opening a new session will stake ${c.green}~${stakeMor} MOR${c.reset} ${c.dim}for 7 days.${c.reset}`,
		)
		console.log(`${c.dim}(MOR is returned when session expires)${c.reset}\n`)

		const confirm = await question(`${c.cyan}Open session and stake?${c.reset} (y/N): `)
		if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
			console.log(`${c.dim}Cancelled.${c.reset}`)
			return null
		}
	}

	return selected.name
}

// =============================================================================
// Learn Menu
// =============================================================================

async function showLearnMenu(rl: readline.Interface): Promise<void> {
	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	while (true) {
		console.log(`\n${c.cyan}${c.bold}Learn About MOR${c.reset}\n`)
		console.log(`  ${c.dim}1.${c.reset} ${c.green}Overview${c.reset}      - What is MOR DIEM?`)
		console.log(`  ${c.dim}2.${c.reset} ${c.green}Staking${c.reset}       - How MOR staking works`)
		console.log(
			`  ${c.dim}3.${c.reset} ${c.green}DIEM${c.reset}          - The decentralized inference model`,
		)
		console.log(`  ${c.dim}4.${c.reset} ${c.green}Epochs${c.reset}        - Network coordination`)
		console.log(`  ${c.dim}5.${c.reset} ${c.green}Wallet${c.reset}        - Setup & security`)
		console.log(`  ${c.dim}6.${c.reset} ${c.green}Models${c.reset}        - Available AI models`)
		console.log('')
		console.log(`  ${c.dim}0.${c.reset} Back to chat`)

		const choice = await question(`\n${c.cyan}Select topic${c.reset}: `)
		const num = Number.parseInt(choice, 10)

		switch (num) {
			case 0:
				return
			case 1:
				console.log(LEARN_CONTENT.overview)
				break
			case 2:
				console.log(LEARN_CONTENT.staking)
				break
			case 3:
				console.log(LEARN_CONTENT.diem)
				break
			case 4:
				console.log(LEARN_CONTENT.epochs)
				break
			case 5:
				console.log(LEARN_CONTENT.wallet)
				break
			case 6:
				console.log(LEARN_CONTENT.models)
				break
			default:
				console.log(`${c.yellow}Invalid selection.${c.reset}`)
		}

		await question(`\n${c.dim}Press Enter to continue...${c.reset}`)
	}
}

// =============================================================================
// Streaming Response
// =============================================================================

async function streamResponse(client: MorpheusClient, state: ChatState): Promise<string> {
	let fullContent = ''
	let isFirstContent = true
	let isFirstReasoning = true
	let receivedFirstChunk = false

	// Thinking animation with elapsed seconds
	const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
	let spinnerIdx = 0
	const startTime = Date.now()

	const updateSpinner = () => {
		if (receivedFirstChunk) return
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
		const frame = spinnerFrames[spinnerIdx % spinnerFrames.length]
		process.stdout.write(
			`\r${c.cyan}${frame}${c.reset} ${c.dim}thinking...${c.reset} ${c.gray}${elapsed}s${c.reset}  `,
		)
		spinnerIdx++
	}

	// Start spinner
	updateSpinner()
	const spinnerInterval = setInterval(updateSpinner, 80)

	try {
		const stream = client.createChatCompletionStream({
			model: state.model.id,
			messages: state.messages,
			max_tokens: 4096,
		})

		let reasoningContent = ''

		for await (const chunk of stream) {
			// Clear spinner on first chunk
			if (!receivedFirstChunk) {
				receivedFirstChunk = true
				clearInterval(spinnerInterval)
				process.stdout.write(`\r${' '.repeat(40)}\r`) // Clear spinner line
				process.stdout.write(`\n${c.blue}${state.model.id}${c.reset}: `)
			}
			const delta = chunk.choices[0]?.delta

			if (delta?.reasoning_content) {
				reasoningContent += delta.reasoning_content
				// Only show reasoning if toggle is ON
				if (state.showReasoning) {
					if (isFirstReasoning) {
						process.stdout.write(`\n${c.dim}${c.italic}[thinking] `)
						isFirstReasoning = false
					}
					process.stdout.write(delta.reasoning_content)
				}
			}

			if (delta?.content) {
				if (state.showReasoning && !isFirstReasoning && isFirstContent) {
					process.stdout.write(`${c.reset}\n\n${c.blue}${state.model.id}${c.reset}: `)
				}
				isFirstContent = false
				process.stdout.write(delta.content)
				fullContent += delta.content
			}
		}

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
		console.log('\n')

		// Verbose output: show timing and token estimates
		if (state.verbose) {
			const responseTokens = Math.ceil(fullContent.length / 4)
			const reasoningTokens = Math.ceil(reasoningContent.length / 4)
			console.log(
				`${c.dim}[${elapsed}s | ~${responseTokens} tokens${reasoningTokens > 0 ? ` | ~${reasoningTokens} reasoning` : ''}]${c.reset}\n`,
			)
		}

		return fullContent
	} catch (error) {
		clearInterval(spinnerInterval)
		if (!receivedFirstChunk) {
			process.stdout.write(`\r${' '.repeat(40)}\r`) // Clear spinner line
		}
		console.log('')
		throw error
	}
}

// =============================================================================
// Main Menu
// =============================================================================

async function showMainMenu(rl: readline.Interface): Promise<string> {
	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	console.clear()
	// Box width: 58 total (║ + 56 visible chars + ║)
	// Helper to pad content to exactly 56 visible chars (strips ANSI when measuring)
	const pad = (s: string, width = 56) => {
		const visible = s.replace(/\x1b\[[0-9;]*m/g, '').length
		return s + ' '.repeat(Math.max(0, width - visible))
	}
	const line = (content: string) =>
		`${c.cyan}${c.bold}║${c.reset}${pad(content)}${c.cyan}${c.bold}║${c.reset}`
	console.log(`
${c.cyan}${c.bold}╔════════════════════════════════════════════════════════╗${c.reset}
${line('')}
${line(`   ${c.green}${c.bold}MOR DIEM${c.reset}`)}
${line(`   ${c.dim}Morpheus Decentralized Inference SDK${c.reset}`)}
${line('')}
${c.cyan}${c.bold}╠════════════════════════════════════════════════════════╣${c.reset}
${line('')}
${line(`   ${c.dim}1.${c.reset} ${c.green}Start Chat${c.reset}       Begin AI conversation`)}
${line(`   ${c.dim}2.${c.reset} ${c.green}Wallet${c.reset}           View balance & approve MOR`)}
${line(`   ${c.dim}3.${c.reset} ${c.green}Learn${c.reset}            How MOR staking works`)}
${line(`   ${c.dim}4.${c.reset} ${c.green}Models${c.reset}           Browse available models`)}
${line(`   ${c.dim}5.${c.reset} ${c.green}Settings${c.reset}         Configure CLI options`)}
${line('')}
${line(`   ${c.dim}0.${c.reset} Exit`)}
${line('')}
${c.cyan}${c.bold}╚════════════════════════════════════════════════════════╝${c.reset}
`)

	return await question(`${c.cyan}Select option${c.reset}: `)
}

// =============================================================================
// Chat Session
// =============================================================================

async function startChatSession(
	client: MorpheusClient,
	rl: readline.Interface,
	state: ChatState,
): Promise<boolean> {
	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	// Select model if not already selected
	if (!state.model.id) {
		const selectedModel = await selectModel(client, rl)
		if (!selectedModel) {
			console.log(`${c.yellow}No model selected.${c.reset}`)
			return true // Return to menu
		}
		const config = MODEL_CONFIGS[selectedModel] || { contextWindow: DEFAULT_CONTEXT_WINDOW }
		state.model = {
			id: selectedModel,
			contextWindow: config.contextWindow,
			compactAt: Math.floor(config.contextWindow * COMPACT_THRESHOLD_RATIO),
		}
	}

	console.log(
		`\n${c.green}Using ${state.model.id}${c.reset} ${c.dim}(${formatTokens(state.model.contextWindow)} context)${c.reset}`,
	)
	console.log(`${c.dim}Type /help for commands, /exit to quit, Ctrl+C to abort${c.reset}\n`)

	// Helper to show prompt status bar
	const showPromptBar = () => {
		const contextUsed = state.tokenEstimate
		const contextTotal = state.model.contextWindow
		const contextPct = Math.round((contextUsed / contextTotal) * 100)
		const contextLeft = contextTotal - contextUsed

		// Build status line: model | context | toggles | quick commands
		const modelPart = `${c.cyan}${state.model.id}${c.reset}`
		const contextPart =
			contextPct > 60
				? `${c.yellow}${formatTokens(contextLeft)} left${c.reset}`
				: `${c.dim}${formatTokens(contextLeft)} left${c.reset}`
		const compactPart =
			state.compactionCount > 0 ? ` ${c.dim}(${state.compactionCount}x compacted)${c.reset}` : ''

		// Toggle indicators (show if non-default)
		const toggles: string[] = []
		if (!state.showReasoning) toggles.push(`${c.yellow}no-think${c.reset}`)
		if (state.verbose) toggles.push(`${c.green}verbose${c.reset}`)
		const togglePart =
			toggles.length > 0 ? ` ${c.dim}[${c.reset}${toggles.join(' ')}${c.dim}]${c.reset}` : ''

		const cmdHint = `${c.dim}/toggle /help${c.reset}`

		console.log(
			`${c.dim}─${c.reset} ${modelPart} ${c.dim}│${c.reset} ${contextPart}${compactPart}${togglePart} ${c.dim}│${c.reset} ${cmdHint}`,
		)
	}

	// Chat loop
	while (true) {
		// Show status bar before every prompt
		showPromptBar()

		const input = await question(`${c.green}You:${c.reset} `)
		const trimmed = input.trim()

		if (!trimmed) continue

		// Handle slash commands
		if (trimmed.startsWith('/')) {
			const spaceIdx = trimmed.indexOf(' ')
			const cmdName =
				spaceIdx > 0 ? trimmed.slice(1, spaceIdx).toLowerCase() : trimmed.slice(1).toLowerCase()
			const cmdArgs = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1) : ''

			const cmd = SLASH_COMMANDS[cmdName]
			if (cmd) {
				const shouldContinue = await cmd.handler(state, client, cmdArgs, rl)
				if (!shouldContinue) {
					return true // Return to menu
				}
				continue
			}

			console.log(`${c.yellow}Unknown command: /${cmdName}. Type /help for commands.${c.reset}\n`)
			continue
		}

		// Add user message
		state.messages.push({ role: 'user', content: trimmed })
		state.tokenEstimate = estimateMessagesTokens(state.messages)

		// Auto-compact if needed
		if (state.tokenEstimate > state.model.compactAt) {
			console.log(`\n${c.cyan}Auto-compacting conversation...${c.reset}`)
			state.messages = await compactConversation(client, state)
			state.tokenEstimate = estimateMessagesTokens(state.messages)
			state.compactionCount++
		}

		// Stream response
		try {
			const response = await streamResponse(client, state)
			state.messages.push({ role: 'assistant', content: response })
			state.tokenEstimate = estimateMessagesTokens(state.messages)
		} catch (e) {
			console.error(`\n${c.red}Error: ${e instanceof Error ? e.message : String(e)}${c.reset}\n`)
			state.messages.pop()
			state.tokenEstimate = estimateMessagesTokens(state.messages)
		}
	}
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function startInteractiveChat(config: {
	apiKey?: string
	baseUrl?: string
	rpcUrl?: string
}): Promise<void> {
	const client = new MorpheusClient({
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		timeout: 300000,
	})

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	const question = (prompt: string): Promise<string> =>
		new Promise((resolve) => rl.question(prompt, resolve))

	// Initialize state
	const state: ChatState = {
		model: { id: '', contextWindow: DEFAULT_CONTEXT_WINDOW, compactAt: 0 },
		messages: [],
		tokenEstimate: 0,
		compactionCount: 0,
		systemPrompt: null,
		// Toggles default to ON
		showReasoning: true,
		streamMode: true,
		verbose: false,
	}

	// Try to load wallet
	const mnemonic = process.env.MOR_MNEMONIC
	if (mnemonic && isValidMnemonic(mnemonic)) {
		const index = Number.parseInt(process.env.MOR_WALLET_INDEX || '0', 10)
		const wallet = deriveWalletFromMnemonic(mnemonic, index)
		state.wallet = { address: wallet.address }
	}

	// Main menu loop
	while (true) {
		const choice = await showMainMenu(rl)
		const num = Number.parseInt(choice, 10)

		switch (num) {
			case 0:
				console.log(`\n${c.dim}Goodbye!${c.reset}\n`)
				rl.close()
				return

			case 1: // Start Chat
				await startChatSession(client, rl, state)
				break

			case 2: // Wallet
				await showWalletMenu(rl, state)
				break

			case 3: // Learn
				await showLearnMenu(rl)
				break

			case 4: {
				// Models
				const selectedModel = await selectModel(client, rl, state.model.id)
				if (selectedModel) {
					const config = MODEL_CONFIGS[selectedModel] || { contextWindow: DEFAULT_CONTEXT_WINDOW }
					state.model = {
						id: selectedModel,
						contextWindow: config.contextWindow,
						compactAt: Math.floor(config.contextWindow * COMPACT_THRESHOLD_RATIO),
					}
					console.log(`\n${c.green}Model set to ${selectedModel}${c.reset}`)
				}
				await question(`\n${c.dim}Press Enter to continue...${c.reset}`)
				break
			}

			case 5: // Settings
				console.log(`\n${c.cyan}${c.bold}Settings${c.reset}\n`)
				console.log(`${c.dim}Environment:${c.reset}`)
				console.log(
					`  MOR_MNEMONIC:     ${mnemonic ? `${c.green}Set${c.reset}` : `${c.yellow}Not set${c.reset}`}`,
				)
				console.log(`  MOR_WALLET_INDEX: ${process.env.MOR_WALLET_INDEX || '0'}`)
				console.log(
					`  MOR_RPC_URL:      ${process.env.MOR_RPC_URL || 'https://arb1.arbitrum.io/rpc'}`,
				)
				console.log(`\n${c.dim}Proxy:${c.reset}`)
				console.log(`  Base URL: ${config.baseUrl || 'http://127.0.0.1:8083'}`)
				console.log(`  Mode:     ${client.mode}`)
				await question(`\n${c.dim}Press Enter to continue...${c.reset}`)
				break

			default:
				console.log(`${c.yellow}Invalid option.${c.reset}`)
				await question(`\n${c.dim}Press Enter to continue...${c.reset}`)
		}
	}
}

export default { startInteractiveChat }
