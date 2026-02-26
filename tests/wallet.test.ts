/**
 * Wallet Tests
 *
 * Tests for BIP39 mnemonic generation, validation, and HD wallet derivation.
 */

import { describe, expect, test } from 'bun:test'
import {
	CONTRACTS,
	deriveWallet,
	deriveWalletFromMnemonic,
	generateNewMnemonic,
	getAccount,
	getPrivateKey,
	isValidMnemonic,
} from '../src/index'

describe('Wallet Generation', () => {
	test('generates valid 12-word mnemonic', () => {
		const mnemonic = generateNewMnemonic(128)
		const words = mnemonic.split(' ')

		expect(words.length).toBe(12)
		expect(isValidMnemonic(mnemonic)).toBe(true)
	})

	test('generates valid 24-word mnemonic', () => {
		const mnemonic = generateNewMnemonic(256)
		const words = mnemonic.split(' ')

		expect(words.length).toBe(24)
		expect(isValidMnemonic(mnemonic)).toBe(true)
	})

	test('generates unique mnemonics each time', () => {
		const mnemonic1 = generateNewMnemonic(128)
		const mnemonic2 = generateNewMnemonic(128)

		expect(mnemonic1).not.toBe(mnemonic2)
	})
})

describe('Mnemonic Validation', () => {
	test('validates correct mnemonic', () => {
		const mnemonic = generateNewMnemonic(128)
		expect(isValidMnemonic(mnemonic)).toBe(true)
	})

	test('rejects invalid mnemonic - wrong words', () => {
		const invalid = 'invalid words that are not a real mnemonic phrase at all'
		expect(isValidMnemonic(invalid)).toBe(false)
	})

	test('rejects invalid mnemonic - wrong checksum', () => {
		// Valid words but wrong checksum
		const invalid =
			'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'
		expect(isValidMnemonic(invalid)).toBe(false)
	})

	test('rejects empty string', () => {
		expect(isValidMnemonic('')).toBe(false)
	})
})

describe('Wallet Derivation', () => {
	// Known test mnemonic (DO NOT USE IN PRODUCTION)
	const testMnemonic = 'test test test test test test test test test test test junk'

	test('derives wallet from mnemonic', () => {
		const wallet = deriveWalletFromMnemonic(testMnemonic, 0)

		expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
		expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
		expect(wallet.publicKey).toBeTruthy()
		expect(wallet.derivationPath).toBe("m/44'/60'/0'/0/0")
	})

	test('derives different addresses for different indices', () => {
		const wallet0 = deriveWalletFromMnemonic(testMnemonic, 0)
		const wallet1 = deriveWalletFromMnemonic(testMnemonic, 1)
		const wallet2 = deriveWalletFromMnemonic(testMnemonic, 2)

		expect(wallet0.address).not.toBe(wallet1.address)
		expect(wallet1.address).not.toBe(wallet2.address)
		expect(wallet0.address).not.toBe(wallet2.address)
	})

	test('derives same address for same mnemonic and index', () => {
		const wallet1 = deriveWalletFromMnemonic(testMnemonic, 0)
		const wallet2 = deriveWalletFromMnemonic(testMnemonic, 0)

		expect(wallet1.address).toBe(wallet2.address)
		expect(wallet1.privateKey).toBe(wallet2.privateKey)
	})

	test('deriveWallet helper works correctly', () => {
		const wallet = deriveWallet(testMnemonic, 0)

		expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
		expect(wallet.derivationPath).toBe("m/44'/60'/0'/0/0")
	})
})

describe('Account Functions', () => {
	const testMnemonic = 'test test test test test test test test test test test junk'

	test('getAccount returns correct address from private key', () => {
		const wallet = deriveWalletFromMnemonic(testMnemonic, 0)
		const account = getAccount(wallet.privateKey)

		expect(account.address).toBe(wallet.address)
	})

	test('getPrivateKey works with mnemonic config', () => {
		const privateKey = getPrivateKey({
			mnemonic: testMnemonic,
			walletIndex: 0,
		})

		expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
	})

	test('getPrivateKey works with direct private key config', () => {
		const wallet = deriveWalletFromMnemonic(testMnemonic, 0)
		const privateKey = getPrivateKey({
			privateKey: wallet.privateKey,
		})

		expect(privateKey).toBe(wallet.privateKey)
	})
})

describe('Contract Addresses', () => {
	test('MOR token address is valid', () => {
		expect(CONTRACTS.MOR_TOKEN).toMatch(/^0x[a-fA-F0-9]{40}$/)
	})

	test('USDC token address is valid', () => {
		expect(CONTRACTS.USDC_TOKEN).toMatch(/^0x[a-fA-F0-9]{40}$/)
	})

	test('Diamond contract address is valid', () => {
		expect(CONTRACTS.DIAMOND_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/)
	})

	test('Uniswap router address is valid', () => {
		expect(CONTRACTS.UNISWAP_ROUTER).toMatch(/^0x[a-fA-F0-9]{40}$/)
	})
})
