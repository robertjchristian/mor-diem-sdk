/**
 * MOR DIEM Wallet - Adapted from EverClaw
 *
 * Cloud-deployable version (no macOS Keychain)
 * Uses environment variables or config for key storage
 *
 * IMPORTANT: Uses Base for Morpheus operations (staking, inference sessions)
 * MOR token and Diamond contract are on Base mainnet.
 *
 * Commands:
 *   generate                 Generate new wallet, print mnemonic + address
 *   address                  Show wallet address
 *   balance                  Show ETH, MOR, USDC balances
 *   swap eth <amount>        Swap ETH for MOR via Uniswap V3
 *   swap usdc <amount>       Swap USDC for MOR via Uniswap V3
 *   approve [amount]         Approve MOR spending for Morpheus Diamond contract
 *
 * Environment:
 *   MOR_PRIVATE_KEY          Private key (0x prefixed)
 *   MOR_MNEMONIC             BIP39 mnemonic (alternative to private key)
 *   MOR_WALLET_INDEX         Derivation index for mnemonic (default: 0)
 *   MOR_RPC_URL              Base RPC URL
 */

import { HDKey } from '@scure/bip32'
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import {
	http,
	createPublicClient,
	createWalletClient,
	formatEther,
	formatUnits,
	maxUint256,
	parseAbi,
	parseEther,
	parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

// =============================================================================
// Configuration - Base Mainnet (Morpheus Network)
// =============================================================================

const RPC_URL = process.env.MOR_RPC_URL || 'https://mainnet.base.org'

// Contract Addresses (Base Mainnet) - Morpheus Network
export const CONTRACTS = {
	MOR_TOKEN: '0x7431aDa8a591C955a994a21710752EF9b882b8e3' as const,
	USDC_TOKEN: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const, // Native USDC on Base
	WETH_TOKEN: '0x4200000000000000000000000000000000000006' as const,
	DIAMOND_CONTRACT: '0x6aBE1d282f72B474E54527D93b979A4f64d3030a' as const,
	UNISWAP_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481' as const, // SwapRouter02 on Base
	UNISWAP_QUOTER: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const, // QuoterV2 on Base
}

// =============================================================================
// ABIs - from EverClaw
// =============================================================================

const ERC20_ABI = parseAbi([
	'function balanceOf(address) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function decimals() view returns (uint8)',
])

const SWAP_ROUTER_ABI = parseAbi([
	'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
])

// =============================================================================
// Wallet Management (Cloud-Compatible)
// =============================================================================

export interface WalletConfig {
	privateKey?: string
	mnemonic?: string
	walletIndex?: number
	rpcUrl?: string
}

export interface DerivedWallet {
	address: `0x${string}`
	privateKey: `0x${string}`
	publicKey: string
	derivationPath?: string
}

function getDerivationPath(index: number): string {
	return `m/44'/60'/0'/0/${index}`
}

export function generateNewMnemonic(strength: 128 | 256 = 128): string {
	return generateMnemonic(wordlist, strength)
}

export function isValidMnemonic(mnemonic: string): boolean {
	return validateMnemonic(mnemonic, wordlist)
}

export function deriveWalletFromMnemonic(mnemonic: string, index = 0): DerivedWallet {
	const seed = mnemonicToSeedSync(mnemonic)
	const hdKey = HDKey.fromMasterSeed(seed)
	const path = getDerivationPath(index)
	const derived = hdKey.derive(path)

	if (!derived.privateKey) {
		throw new Error('Failed to derive private key')
	}

	const privateKeyHex = Buffer.from(derived.privateKey).toString('hex')
	const privateKey = `0x${privateKeyHex}` as `0x${string}`
	const account = privateKeyToAccount(privateKey)

	return {
		address: account.address,
		privateKey,
		publicKey: Buffer.from(derived.publicKey!).toString('hex'),
		derivationPath: path,
	}
}

export function getPrivateKey(config: WalletConfig): `0x${string}` {
	if (config.privateKey) {
		return config.privateKey.startsWith('0x')
			? (config.privateKey as `0x${string}`)
			: (`0x${config.privateKey}` as `0x${string}`)
	}

	if (config.mnemonic) {
		const wallet = deriveWalletFromMnemonic(config.mnemonic, config.walletIndex ?? 0)
		return wallet.privateKey
	}

	// Check environment variables
	const envKey = process.env.MOR_PRIVATE_KEY
	if (envKey) {
		return envKey.startsWith('0x') ? (envKey as `0x${string}`) : (`0x${envKey}` as `0x${string}`)
	}

	const envMnemonic = process.env.MOR_MNEMONIC
	if (envMnemonic) {
		const index = Number.parseInt(process.env.MOR_WALLET_INDEX || '0', 10)
		const wallet = deriveWalletFromMnemonic(envMnemonic, index)
		return wallet.privateKey
	}

	throw new Error('No wallet configured. Set MOR_PRIVATE_KEY or MOR_MNEMONIC environment variable.')
}

// =============================================================================
// Viem Clients
// =============================================================================

export function getPublicClient(rpcUrl?: string) {
	return createPublicClient({
		chain: base,
		transport: http(rpcUrl || RPC_URL),
	})
}

export function getWalletClient(privateKey: `0x${string}`, rpcUrl?: string) {
	const account = privateKeyToAccount(privateKey)
	return createWalletClient({
		account,
		chain: base,
		transport: http(rpcUrl || RPC_URL),
	})
}

export function getAccount(privateKey: `0x${string}`) {
	return privateKeyToAccount(privateKey)
}

// =============================================================================
// Balance Functions - from EverClaw
// =============================================================================

export interface Balances {
	eth: bigint
	ethFormatted: string
	mor: bigint
	morFormatted: string
	usdc: bigint
	usdcFormatted: string
	morAllowance: bigint
	morAllowanceFormatted: string
	isUnlimitedAllowance: boolean
}

export async function getBalances(config: WalletConfig): Promise<Balances> {
	const privateKey = getPrivateKey(config)
	const account = getAccount(privateKey)
	const client = getPublicClient(config.rpcUrl)

	// ETH balance
	const eth = await client.getBalance({ address: account.address })

	// MOR balance
	const mor = await client.readContract({
		address: CONTRACTS.MOR_TOKEN,
		abi: ERC20_ABI,
		functionName: 'balanceOf',
		args: [account.address],
	})

	// USDC balance
	const usdc = await client.readContract({
		address: CONTRACTS.USDC_TOKEN,
		abi: ERC20_ABI,
		functionName: 'balanceOf',
		args: [account.address],
	})

	// MOR allowance for Diamond
	const morAllowance = await client.readContract({
		address: CONTRACTS.MOR_TOKEN,
		abi: ERC20_ABI,
		functionName: 'allowance',
		args: [account.address, CONTRACTS.DIAMOND_CONTRACT],
	})

	return {
		eth,
		ethFormatted: formatEther(eth),
		mor,
		morFormatted: formatEther(mor),
		usdc,
		usdcFormatted: formatUnits(usdc, 6),
		morAllowance,
		morAllowanceFormatted: formatEther(morAllowance),
		isUnlimitedAllowance: morAllowance >= maxUint256 / 2n,
	}
}

// =============================================================================
// Swap Functions - from EverClaw
// =============================================================================

export interface SwapResult {
	txHash: `0x${string}`
	amountIn: bigint
	tokenIn: 'eth' | 'usdc'
}

export async function swapEthForMor(config: WalletConfig, ethAmount: string): Promise<SwapResult> {
	const privateKey = getPrivateKey(config)
	const account = getAccount(privateKey)
	const publicClient = getPublicClient(config.rpcUrl)
	const walletClient = getWalletClient(privateKey, config.rpcUrl)

	const amountIn = parseEther(ethAmount)
	const fee = 10000 // 1% fee tier (most common for MOR pairs)

	const swapParams = {
		tokenIn: CONTRACTS.WETH_TOKEN,
		tokenOut: CONTRACTS.MOR_TOKEN,
		fee,
		recipient: account.address,
		amountIn,
		amountOutMinimum: 0n, // Accept any amount (slippage tolerance for simplicity)
		sqrtPriceLimitX96: 0n,
	}

	const txHash = await walletClient.writeContract({
		address: CONTRACTS.UNISWAP_ROUTER,
		abi: SWAP_ROUTER_ABI,
		functionName: 'exactInputSingle',
		args: [swapParams],
		value: amountIn,
	})

	await publicClient.waitForTransactionReceipt({ hash: txHash })

	return { txHash, amountIn, tokenIn: 'eth' }
}

export async function swapUsdcForMor(
	config: WalletConfig,
	usdcAmount: string,
): Promise<SwapResult> {
	const privateKey = getPrivateKey(config)
	const account = getAccount(privateKey)
	const publicClient = getPublicClient(config.rpcUrl)
	const walletClient = getWalletClient(privateKey, config.rpcUrl)

	const amountIn = parseUnits(usdcAmount, 6)
	const fee = 10000

	// Approve USDC for router
	const approveTx = await walletClient.writeContract({
		address: CONTRACTS.USDC_TOKEN,
		abi: ERC20_ABI,
		functionName: 'approve',
		args: [CONTRACTS.UNISWAP_ROUTER, amountIn],
	})
	await publicClient.waitForTransactionReceipt({ hash: approveTx })

	// Execute swap
	const swapParams = {
		tokenIn: CONTRACTS.USDC_TOKEN,
		tokenOut: CONTRACTS.MOR_TOKEN,
		fee,
		recipient: account.address,
		amountIn,
		amountOutMinimum: 0n,
		sqrtPriceLimitX96: 0n,
	}

	const txHash = await walletClient.writeContract({
		address: CONTRACTS.UNISWAP_ROUTER,
		abi: SWAP_ROUTER_ABI,
		functionName: 'exactInputSingle',
		args: [swapParams],
		value: 0n,
	})

	await publicClient.waitForTransactionReceipt({ hash: txHash })

	return { txHash, amountIn, tokenIn: 'usdc' }
}

// =============================================================================
// Approve Functions - from EverClaw
// =============================================================================

export interface ApproveResult {
	txHash: `0x${string}`
	amount: bigint
	isUnlimited: boolean
}

export async function approveMor(config: WalletConfig, amount?: bigint): Promise<ApproveResult> {
	const privateKey = getPrivateKey(config)
	const publicClient = getPublicClient(config.rpcUrl)
	const walletClient = getWalletClient(privateKey, config.rpcUrl)

	const approveAmount = amount ?? maxUint256

	const txHash = await walletClient.writeContract({
		address: CONTRACTS.MOR_TOKEN,
		abi: ERC20_ABI,
		functionName: 'approve',
		args: [CONTRACTS.DIAMOND_CONTRACT, approveAmount],
	})

	await publicClient.waitForTransactionReceipt({ hash: txHash })

	return {
		txHash,
		amount: approveAmount,
		isUnlimited: approveAmount === maxUint256,
	}
}

// =============================================================================
// Exports
// =============================================================================

export default {
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
}
