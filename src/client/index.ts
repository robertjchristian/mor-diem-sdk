/**
 * Morpheus Inference Client
 *
 * OpenAI-compatible client for Morpheus inference.
 * Supports two modes:
 *
 * 1. Gateway Mode (recommended for simplicity)
 *    - Uses hosted API at api.mor.org
 *    - Requires API key from app.mor.org
 *    - No staking or local infrastructure needed
 *
 * 2. P2P Mode (advanced)
 *    - Connects to local Morpheus proxy/router
 *    - Requires MOR staking and running router binary
 *    - True decentralized access
 */

// =============================================================================
// Types
// =============================================================================

export interface MorpheusClientConfig {
	/**
	 * API key for gateway mode (from app.mor.org)
	 * If not provided, falls back to P2P mode
	 */
	apiKey?: string

	/**
	 * Base URL for the API
	 * Gateway mode default: https://api.mor.org/api/v1
	 * P2P mode default: http://127.0.0.1:8083
	 */
	baseUrl?: string

	/**
	 * Default model to use for completions
	 * Default: kimi-k2.5
	 */
	defaultModel?: string

	/**
	 * Request timeout in milliseconds
	 * Default: 120000 (2 minutes)
	 */
	timeout?: number
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface ChatCompletionRequest {
	model?: string
	messages: ChatMessage[]
	temperature?: number
	max_tokens?: number
	top_p?: number
	stream?: boolean
	stop?: string | string[]
}

export interface ChatCompletionChoice {
	index: number
	message: ChatMessage
	finish_reason: 'stop' | 'length' | 'content_filter' | null
}

export interface StreamDelta {
	role?: 'assistant'
	content?: string
	reasoning_content?: string
}

export interface StreamChoice {
	index: number
	delta: StreamDelta
	finish_reason: 'stop' | 'length' | 'content_filter' | null
}

export interface ChatCompletionChunk {
	id: string
	object: 'chat.completion.chunk'
	created: number
	model: string
	choices: StreamChoice[]
}

export interface ChatCompletionUsage {
	prompt_tokens: number
	completion_tokens: number
	total_tokens: number
}

export interface ChatCompletionResponse {
	id: string
	object: 'chat.completion'
	created: number
	model: string
	choices: ChatCompletionChoice[]
	usage?: ChatCompletionUsage
}

export interface ModelInfo {
	id: string
	object: 'model'
	created: number
	owned_by: string
}

export interface ModelsResponse {
	object: 'list'
	data: ModelInfo[]
}

export interface MorpheusError {
	error: {
		message: string
		type: string
		code: string | null
		param: string | null
	}
}

// =============================================================================
// Constants
// =============================================================================

// P2P mode via morpheus-proxy (from EverClaw)
const P2P_BASE_URL = 'http://127.0.0.1:8083'
const DEFAULT_MODEL = 'kimi-k2.5'
const DEFAULT_TIMEOUT = 300000 // 5 minutes for P2P inference

// Available models on the Morpheus network
export const AVAILABLE_MODELS = [
	'kimi-k2.5',
	'kimi-k2.5:web',
	'kimi-k2-thinking',
	'glm-4.7-flash',
	'glm-4.7',
	'qwen3-235b',
	'llama-3.3-70b',
	'gpt-oss-120b',
] as const

export type MorpheusModel = (typeof AVAILABLE_MODELS)[number]

// =============================================================================
// Client Class
// =============================================================================

export class MorpheusClient {
	private readonly baseUrl: string
	private readonly apiKey?: string
	private readonly defaultModel: string
	private readonly timeout: number

	constructor(config: MorpheusClientConfig = {}) {
		this.apiKey = config.apiKey
		this.defaultModel = config.defaultModel ?? DEFAULT_MODEL
		this.timeout = config.timeout ?? DEFAULT_TIMEOUT

		// P2P mode - connect to local morpheus-proxy
		this.baseUrl = config.baseUrl?.replace(/\/$/, '') ?? P2P_BASE_URL
	}

	/**
	 * Get the mode the client is operating in
	 */
	get mode(): 'gateway' | 'p2p' {
		return this.apiKey ? 'gateway' : 'p2p'
	}

	/**
	 * Make a request to the Morpheus API
	 */
	private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
		const url = `${this.baseUrl}${path}`

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		if (this.apiKey) {
			headers.Authorization = `Bearer ${this.apiKey}`
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				let errorBody: MorpheusError | null = null
				try {
					errorBody = (await response.json()) as MorpheusError
				} catch {
					// Ignore JSON parse errors
				}

				const message =
					errorBody?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`
				throw new Error(message)
			}

			return (await response.json()) as T
		} catch (error) {
			clearTimeout(timeoutId)

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error(`Request timed out after ${this.timeout}ms`)
				}
				throw error
			}

			throw new Error('Unknown error occurred')
		}
	}

	/**
	 * List available models
	 */
	async listModels(): Promise<ModelsResponse> {
		return this.request<ModelsResponse>('GET', '/v1/models')
	}

	/**
	 * Create a chat completion (non-streaming)
	 */
	async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
		const body = {
			...request,
			model: request.model ?? this.defaultModel,
			stream: false,
		}

		return this.request<ChatCompletionResponse>('POST', '/v1/chat/completions', body)
	}

	/**
	 * Create a streaming chat completion
	 * Yields chunks as they arrive, handles SSE parsing
	 */
	async *createChatCompletionStream(
		request: ChatCompletionRequest,
	): AsyncGenerator<ChatCompletionChunk, void, unknown> {
		const url = `${this.baseUrl}/v1/chat/completions`

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		if (this.apiKey) {
			headers.Authorization = `Bearer ${this.apiKey}`
		}

		const body = {
			...request,
			model: request.model ?? this.defaultModel,
			stream: true,
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				let errorBody: MorpheusError | null = null
				try {
					errorBody = (await response.json()) as MorpheusError
				} catch {
					// Ignore JSON parse errors
				}
				const message =
					errorBody?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`
				throw new Error(message)
			}

			if (!response.body) {
				throw new Error('No response body')
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })

				// Parse SSE events
				const lines = buffer.split('\n')
				buffer = lines.pop() || '' // Keep incomplete line in buffer

				for (const line of lines) {
					const trimmed = line.trim()
					if (!trimmed || trimmed === 'data: [DONE]') continue

					if (trimmed.startsWith('data: ')) {
						try {
							const json = trimmed.slice(6)
							const chunk = JSON.parse(json) as ChatCompletionChunk
							yield chunk
						} catch {
							// Skip malformed JSON
						}
					}
				}
			}
		} catch (error) {
			clearTimeout(timeoutId)

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error(`Request timed out after ${this.timeout}ms`)
				}
				throw error
			}

			throw new Error('Unknown error occurred')
		}
	}

	/**
	 * Simple completion helper - just send a message and get a response
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
		const messages: ChatMessage[] = []

		if (options?.systemPrompt) {
			messages.push({ role: 'system', content: options.systemPrompt })
		}

		messages.push({ role: 'user', content: message })

		const response = await this.createChatCompletion({
			model: options?.model,
			messages,
			temperature: options?.temperature,
			max_tokens: options?.maxTokens,
		})

		return response.choices[0]?.message?.content ?? ''
	}

	/**
	 * Check if the API is healthy/reachable
	 */
	async healthCheck(): Promise<{
		ok: boolean
		mode: 'gateway' | 'p2p'
		baseUrl: string
		error?: string
	}> {
		try {
			// Try listing models as a health check
			await this.listModels()
			return {
				ok: true,
				mode: this.mode,
				baseUrl: this.baseUrl,
			}
		} catch (error) {
			return {
				ok: false,
				mode: this.mode,
				baseUrl: this.baseUrl,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a client for P2P mode via morpheus-proxy
 */
export function createP2PClient(options?: Partial<MorpheusClientConfig>): MorpheusClient {
	return new MorpheusClient({
		...options,
		baseUrl: options?.baseUrl ?? P2P_BASE_URL,
	})
}

// =============================================================================
// Exports
// =============================================================================

export default {
	MorpheusClient,
	createP2PClient,
	AVAILABLE_MODELS,
	P2P_BASE_URL,
}
