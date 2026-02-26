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
export declare const AVAILABLE_MODELS: readonly [
	'kimi-k2.5',
	'kimi-k2.5:web',
	'kimi-k2-thinking',
	'glm-4.7-flash',
	'glm-4.7',
	'qwen3-235b',
	'llama-3.3-70b',
	'gpt-oss-120b',
]
export type MorpheusModel = (typeof AVAILABLE_MODELS)[number]
export declare class MorpheusClient {
	private readonly baseUrl
	private readonly apiKey?
	private readonly defaultModel
	private readonly timeout
	constructor(config?: MorpheusClientConfig)
	/**
	 * Get the mode the client is operating in
	 */
	get mode(): 'gateway' | 'p2p'
	/**
	 * Make a request to the Morpheus API
	 */
	private request
	/**
	 * List available models
	 */
	listModels(): Promise<ModelsResponse>
	/**
	 * Create a chat completion (non-streaming)
	 */
	createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
	/**
	 * Create a streaming chat completion
	 * Yields chunks as they arrive, handles SSE parsing
	 */
	createChatCompletionStream(
		request: ChatCompletionRequest,
	): AsyncGenerator<ChatCompletionChunk, void, unknown>
	/**
	 * Simple completion helper - just send a message and get a response
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
	 * Check if the API is healthy/reachable
	 */
	healthCheck(): Promise<{
		ok: boolean
		mode: 'gateway' | 'p2p'
		baseUrl: string
		error?: string
	}>
}
/**
 * Create a client for P2P mode via morpheus-proxy
 */
export declare function createP2PClient(options?: Partial<MorpheusClientConfig>): MorpheusClient
declare const _default: {
	MorpheusClient: typeof MorpheusClient
	createP2PClient: typeof createP2PClient
	AVAILABLE_MODELS: readonly [
		'kimi-k2.5',
		'kimi-k2.5:web',
		'kimi-k2-thinking',
		'glm-4.7-flash',
		'glm-4.7',
		'qwen3-235b',
		'llama-3.3-70b',
		'gpt-oss-120b',
	]
	P2P_BASE_URL: string
}
export default _default
//# sourceMappingURL=index.d.ts.map
