/**
 * Client Tests
 *
 * Tests for MorpheusClient and API interactions.
 */

import { describe, expect, test } from 'bun:test'
import { AVAILABLE_MODELS, MorpheusClient, createP2PClient } from '../src/client/index'

describe('Client Initialization', () => {
	test('creates P2P client with default config', () => {
		const client = createP2PClient()

		expect(client.mode).toBe('p2p')
	})

	test('creates client with custom base URL', () => {
		const client = new MorpheusClient({
			baseUrl: 'http://custom:8080',
		})

		expect(client.mode).toBe('p2p')
	})

	test('creates gateway client with API key', () => {
		const client = new MorpheusClient({
			apiKey: 'test-api-key',
		})

		expect(client.mode).toBe('gateway')
	})

	test('custom timeout can be set', () => {
		const client = new MorpheusClient({
			timeout: 60000,
		})

		expect(client).toBeTruthy()
	})

	test('custom default model can be set', () => {
		const client = new MorpheusClient({
			defaultModel: 'glm-4.7-flash',
		})

		expect(client).toBeTruthy()
	})
})

describe('Available Models', () => {
	test('AVAILABLE_MODELS is populated', () => {
		expect(AVAILABLE_MODELS.length).toBeGreaterThan(0)
	})

	test('kimi-k2.5 is in available models', () => {
		expect(AVAILABLE_MODELS).toContain('kimi-k2.5')
	})

	test('all models are strings', () => {
		for (const model of AVAILABLE_MODELS) {
			expect(typeof model).toBe('string')
			expect(model.length).toBeGreaterThan(0)
		}
	})
})
