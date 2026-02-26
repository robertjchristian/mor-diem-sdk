/**
 * MOR DIEM SDK
 *
 * Morpheus Decentralized Inference SDK
 * Adapted from EverClaw (https://github.com/EverClaw/everclaw)
 *
 * P2P staking-based inference - MOR tokens, no API keys.
 *
 * Architecture:
 *   Chat CLI → morpheus-proxy (8083) → proxy-router (8082) → blockchain providers
 *
 * @example P2P mode with wallet
 * ```ts
 * import { MorDiemSDK } from 'mor-diem-sdk'
 *
 * // Set MOR_MNEMONIC env var, or pass directly
 * const sdk = new MorDiemSDK({ mnemonic: process.env.MOR_MNEMONIC })
 *
 * // Check balances (MOR on Base)
 * const balances = await sdk.getBalances()
 * console.log(`MOR: ${balances.morFormatted}`)
 *
 * // Make inference call (via local morpheus-proxy)
 * const response = await sdk.complete('Hello, world!')
 * ```
 */

import type { Hex } from 'viem'

// =============================================================================
// Re-exports from wallet module (EverClaw-adapted)
// =============================================================================

export {
	CONTRACTS,
	generateNewMnemonic,
	isValidMnemonic,
	deriveWalletFromMnemonic,
	getPrivateKey,
	getPublicClient,
	getWalletClient,
	getAccount,
	getBalances,
	swapEthForMor,
	swapUsdcForMor,
	approveMor,
	type WalletConfig,
	type DerivedWallet,
	type Balances,
	type SwapResult,
	type ApproveResult,
} from './wallet/wallet.js'

// =============================================================================
// Re-exports from client module
// =============================================================================

export {
	MorpheusClient,
	createP2PClient,
	AVAILABLE_MODELS,
	type MorpheusClientConfig,
	type ChatMessage,
	type ChatCompletionRequest,
	type ChatCompletionResponse,
	type ChatCompletionChunk,
	type ModelsResponse,
} from './client/index.js'

// =============================================================================
// SDK Configuration
// =============================================================================

export interface MorDiemSDKConfig {
	/**
	 * BIP39 mnemonic for wallet operations
	 */
	mnemonic?: string

	/**
	 * Wallet derivation index (default: 0)
	 */
	walletIndex?: number

	/**
	 * Private key (alternative to mnemonic)
	 */
	privateKey?: Hex

	/**
	 * Morpheus proxy URL (default: http://127.0.0.1:8083)
	 */
	proxyUrl?: string

	/**
	 * Custom RPC URL for Base blockchain operations
	 */
	rpcUrl?: string

	/**
	 * Default model for completions
	 */
	defaultModel?: string
}

// =============================================================================
// Imports for SDK class
// =============================================================================

import { MorpheusClient, type MorpheusClientConfig } from './client/index.js'
import {
	type Balances,
	type DerivedWallet,
	type WalletConfig,
	approveMor as approveFunc,
	deriveWalletFromMnemonic,
	getAccount as getAccountFunc,
	getBalances as getBalancesFunc,
	isValidMnemonic as isValidMnemonicFunc,
	swapEthForMor as swapEthFunc,
	swapUsdcForMor as swapUsdcFunc,
} from './wallet/wallet.js'

// =============================================================================
// SDK Class
// =============================================================================

export class MorDiemSDK {
	private readonly config: MorDiemSDKConfig
	private readonly client: MorpheusClient
	private readonly walletConfig: WalletConfig
	private wallet?: DerivedWallet
	private _privateKey?: `0x${string}`

	constructor(config: MorDiemSDKConfig = {}) {
		this.config = config

		// Build wallet config
		this.walletConfig = {
			mnemonic: config.mnemonic,
			privateKey: config.privateKey,
			walletIndex: config.walletIndex,
			rpcUrl: config.rpcUrl,
		}

		// Derive wallet if mnemonic provided
		if (config.mnemonic) {
			if (!isValidMnemonicFunc(config.mnemonic)) {
				throw new Error('Invalid mnemonic')
			}
			const index = config.walletIndex ?? 0
			this.wallet = deriveWalletFromMnemonic(config.mnemonic, index)
			this._privateKey = this.wallet.privateKey
		} else if (config.privateKey) {
			this._privateKey = config.privateKey.startsWith('0x')
				? (config.privateKey as `0x${string}`)
				: (`0x${config.privateKey}` as `0x${string}`)
		}

		// Create inference client - P2P mode (morpheus-proxy on 8083)
		const proxyUrl = config.proxyUrl || 'http://127.0.0.1:8083'
		const clientConfig: MorpheusClientConfig = {
			baseUrl: proxyUrl,
			defaultModel: config.defaultModel,
			timeout: 300000, // 5 minutes for P2P inference
		}

		this.client = new MorpheusClient(clientConfig)
	}

	// ===========================================================================
	// Static Helpers
	// ===========================================================================

	/**
	 * Generate a new BIP39 mnemonic
	 * @param strength - 128 for 12 words, 256 for 24 words
	 */
	static generateMnemonic(strength: 128 | 256 = 128): string {
		const { generateMnemonic } = require('@scure/bip39')
		const { wordlist } = require('@scure/bip39/wordlists/english')
		return generateMnemonic(wordlist, strength)
	}

	/**
	 * Validate a BIP39 mnemonic
	 */
	static isValidMnemonic(mnemonic: string): boolean {
		return isValidMnemonicFunc(mnemonic)
	}

	/**
	 * Create SDK from mnemonic
	 */
	static fromMnemonic(config: {
		mnemonic: string
		walletIndex?: number
		proxyUrl?: string
		rpcUrl?: string
		defaultModel?: string
	}): MorDiemSDK {
		return new MorDiemSDK(config)
	}

	// ===========================================================================
	// Wallet Info
	// ===========================================================================

	/**
	 * Get the wallet address
	 */
	get address(): `0x${string}` {
		if (this.wallet) {
			return this.wallet.address
		}
		if (this._privateKey) {
			return getAccountFunc(this._privateKey).address
		}
		throw new Error('No wallet configured')
	}

	/**
	 * Get the wallet derivation path
	 */
	get derivationPath(): string | undefined {
		return this.wallet?.derivationPath
	}

	/**
	 * Get the wallet index
	 */
	get walletIndex(): number {
		return this.config.walletIndex ?? 0
	}

	/**
	 * Always P2P mode (no gateway API)
	 */
	get mode(): 'p2p' {
		return 'p2p'
	}

	// ===========================================================================
	// Token Operations (Base chain)
	// ===========================================================================

	/**
	 * Get token balances (ETH, MOR, USDC on Base)
	 */
	async getBalances(): Promise<Balances> {
		return getBalancesFunc(this.walletConfig)
	}

	/**
	 * Swap ETH for MOR on Uniswap V3 (Base)
	 */
	async swapEthForMor(amount: string) {
		return swapEthFunc(this.walletConfig, amount)
	}

	/**
	 * Swap USDC for MOR on Uniswap V3 (Base)
	 */
	async swapUsdcForMor(amount: string) {
		return swapUsdcFunc(this.walletConfig, amount)
	}

	/**
	 * Approve MOR for Morpheus Diamond contract (required for staking)
	 */
	async approveMor(amount?: bigint) {
		return approveFunc(this.walletConfig, amount)
	}

	// ===========================================================================
	// Inference (via morpheus-proxy)
	// ===========================================================================

	/**
	 * Simple completion - send a message, get a response
	 */
	async complete(
		message: string,
		options?: {
			model?: string
			systemPrompt?: string
			temperature?: number
			maxTokens?: number
		},
	): Promise<string> {
		return this.client.complete(message, options)
	}

	/**
	 * Full chat completion API (non-streaming)
	 */
	async createChatCompletion(request: Parameters<typeof this.client.createChatCompletion>[0]) {
		return this.client.createChatCompletion(request)
	}

	/**
	 * Streaming chat completion
	 */
	createChatCompletionStream(
		request: Parameters<typeof this.client.createChatCompletionStream>[0],
	) {
		return this.client.createChatCompletionStream(request)
	}

	/**
	 * List available models from morpheus-proxy
	 */
	async listModels() {
		return this.client.listModels()
	}

	/**
	 * Check morpheus-proxy health
	 */
	async healthCheck() {
		return this.client.healthCheck()
	}

	// ===========================================================================
	// Raw Client Access
	// ===========================================================================

	/**
	 * Get the underlying MorpheusClient for advanced usage
	 */
	getClient(): MorpheusClient {
		return this.client
	}
}

// =============================================================================
// Convenience exports for wallet operations
// =============================================================================

export function deriveWallet(mnemonic: string, index = 0): DerivedWallet {
	return deriveWalletFromMnemonic(mnemonic, index)
}

export { generateNewMnemonic as generateMnemonic } from './wallet/wallet.js'

// =============================================================================
// Default Export
// =============================================================================

export default MorDiemSDK
