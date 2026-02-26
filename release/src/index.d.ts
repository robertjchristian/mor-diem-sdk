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
export {
	MorpheusClient,
	createP2PClient,
	type MorpheusClientConfig,
	type ChatMessage,
	type ChatCompletionRequest,
	type ChatCompletionResponse,
	type ChatCompletionChunk,
	type ModelsResponse,
} from './client/index.js'
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
import type { MorpheusClient } from './client/index.js'
import type { Balances, DerivedWallet } from './wallet/wallet.js'
export declare class MorDiemSDK {
	private readonly config
	private readonly client
	private readonly walletConfig
	private wallet?
	private _privateKey?
	constructor(config?: MorDiemSDKConfig)
	/**
	 * Generate a new BIP39 mnemonic
	 * @param strength - 128 for 12 words, 256 for 24 words
	 */
	static generateMnemonic(strength?: 128 | 256): string
	/**
	 * Validate a BIP39 mnemonic
	 */
	static isValidMnemonic(mnemonic: string): boolean
	/**
	 * Create SDK from mnemonic
	 */
	static fromMnemonic(config: {
		mnemonic: string
		walletIndex?: number
		proxyUrl?: string
		rpcUrl?: string
		defaultModel?: string
	}): MorDiemSDK
	/**
	 * Get the wallet address
	 */
	get address(): `0x${string}`
	/**
	 * Get the wallet derivation path
	 */
	get derivationPath(): string | undefined
	/**
	 * Get the wallet index
	 */
	get walletIndex(): number
	/**
	 * Always P2P mode (no gateway API)
	 */
	get mode(): 'p2p'
	/**
	 * Get token balances (ETH, MOR, USDC on Base)
	 */
	getBalances(): Promise<Balances>
	/**
	 * Swap ETH for MOR on Uniswap V3 (Base)
	 */
	swapEthForMor(amount: string): Promise<import('./index.js').SwapResult>
	/**
	 * Swap USDC for MOR on Uniswap V3 (Base)
	 */
	swapUsdcForMor(amount: string): Promise<import('./index.js').SwapResult>
	/**
	 * Approve MOR for Morpheus Diamond contract (required for staking)
	 */
	approveMor(amount?: bigint): Promise<import('./index.js').ApproveResult>
	/**
	 * Simple completion - send a message, get a response
	 */
	complete(
		message: string,
		options?: {
			model?: string
			systemPrompt?: string
			temperature?: number
			maxTokens?: number
		},
	): Promise<string>
	/**
	 * Full chat completion API (non-streaming)
	 */
	createChatCompletion(
		request: Parameters<typeof this.client.createChatCompletion>[0],
	): Promise<import('./index.js').ChatCompletionResponse>
	/**
	 * Streaming chat completion
	 */
	createChatCompletionStream(
		request: Parameters<typeof this.client.createChatCompletionStream>[0],
	): AsyncGenerator<import('./index.js').ChatCompletionChunk, void, unknown>
	/**
	 * List available models from morpheus-proxy
	 */
	listModels(): Promise<import('./index.js').ModelsResponse>
	/**
	 * Check morpheus-proxy health
	 */
	healthCheck(): Promise<{
		ok: boolean
		mode: 'gateway' | 'p2p'
		baseUrl: string
		error?: string
	}>
	/**
	 * Get the underlying MorpheusClient for advanced usage
	 */
	getClient(): MorpheusClient
}
export declare function deriveWallet(mnemonic: string, index?: number): DerivedWallet
export { generateNewMnemonic as generateMnemonic } from './wallet/wallet.js'
export default MorDiemSDK
//# sourceMappingURL=index.d.ts.map
