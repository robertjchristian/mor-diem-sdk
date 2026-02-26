/**
 * SDK Tests
 *
 * Tests for MorDiemSDK initialization and configuration.
 */

import { describe, expect, test } from 'bun:test'
import { MorDiemSDK, generateNewMnemonic } from '../src/index'

describe('SDK Initialization', () => {
	const testMnemonic = 'test test test test test test test test test test test junk'

	test('creates SDK with mnemonic', () => {
		const sdk = new MorDiemSDK({
			mnemonic: testMnemonic,
		})

		expect(sdk.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
		expect(sdk.mode).toBe('p2p')
	})

	test('creates SDK with custom wallet index', () => {
		const sdk0 = new MorDiemSDK({
			mnemonic: testMnemonic,
			walletIndex: 0,
		})

		const sdk1 = new MorDiemSDK({
			mnemonic: testMnemonic,
			walletIndex: 1,
		})

		expect(sdk0.address).not.toBe(sdk1.address)
		expect(sdk0.walletIndex).toBe(0)
		expect(sdk1.walletIndex).toBe(1)
	})

	test('throws on invalid mnemonic', () => {
		expect(() => {
			new MorDiemSDK({
				mnemonic: 'invalid mnemonic words',
			})
		}).toThrow('Invalid mnemonic')
	})

	test('SDK.fromMnemonic static method works', () => {
		const sdk = MorDiemSDK.fromMnemonic({
			mnemonic: testMnemonic,
		})

		expect(sdk.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
	})

	test('SDK.generateMnemonic static method works', () => {
		const mnemonic = MorDiemSDK.generateMnemonic()
		expect(mnemonic.split(' ').length).toBe(12)
	})

	test('SDK.isValidMnemonic static method works', () => {
		const valid = generateNewMnemonic(128)
		const invalid = 'not a valid mnemonic'

		expect(MorDiemSDK.isValidMnemonic(valid)).toBe(true)
		expect(MorDiemSDK.isValidMnemonic(invalid)).toBe(false)
	})
})

describe('SDK Configuration', () => {
	const testMnemonic = 'test test test test test test test test test test test junk'

	test('default proxy URL is localhost:8083', () => {
		const sdk = new MorDiemSDK({
			mnemonic: testMnemonic,
		})

		const client = sdk.getClient()
		expect(client).toBeTruthy()
	})

	test('custom proxy URL can be set', () => {
		const sdk = new MorDiemSDK({
			mnemonic: testMnemonic,
			proxyUrl: 'http://custom-proxy:9000',
		})

		expect(sdk).toBeTruthy()
	})

	test('derivation path is correct', () => {
		const sdk = new MorDiemSDK({
			mnemonic: testMnemonic,
			walletIndex: 5,
		})

		expect(sdk.derivationPath).toBe("m/44'/60'/0'/0/5")
	})
})
