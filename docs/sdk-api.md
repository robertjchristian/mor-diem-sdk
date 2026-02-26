# SDK API Reference

## Wallet Options

Two ways to configure a wallet:

| Option | Use Case |
|--------|----------|
| `mnemonic` | Dev/testing - derive N wallets from one seed |
| `privateKey` | Production - single wallet, direct control |

### Why Mnemonic?

**Benefit:** One seed phrase generates unlimited wallets. Increment `walletIndex` to get wallet 0, 1, 2, etc. Useful when:
- Developing and testing with multiple accounts
- Running integration tests against fresh wallets
- Managing a fleet of wallets from one backup

**Warning:** Mnemonic-based wallets are primarily for development. In production:
- Use a single private key for simplicity
- Or use proper key management (HSM, vault, etc.)
- Never store mnemonics in code or environment variables on production servers

### Private Key

Single wallet, no derivation. Use this in production when you need one dedicated wallet.

```typescript
// Mnemonic - derive multiple wallets (dev/testing)
const sdk = new MorDiemSDK({ mnemonic: '...', walletIndex: 0 })  // wallet 0
const sdk2 = new MorDiemSDK({ mnemonic: '...', walletIndex: 1 }) // wallet 1

// Private key - single wallet (production)
const sdk = new MorDiemSDK({ privateKey: '0x...' })
```

## MorDiemSDK

```typescript
import { MorDiemSDK } from 'mor-diem-sdk'

const sdk = new MorDiemSDK({
  mnemonic: string,           // BIP39 (12 or 24 words)
  walletIndex?: number,       // Default: 0
  privateKey?: string,        // Alternative to mnemonic
  proxyUrl?: string,          // Default: http://127.0.0.1:8083
  rpcUrl?: string,            // Base RPC URL
  defaultModel?: string,      // Default model
})
```

### Properties

```typescript
sdk.address   // 0x...
sdk.mode      // 'p2p'
```

### Wallet

```typescript
// Balances
const balances = await sdk.getBalances()
// { eth, ethFormatted, mor, morFormatted, usdc, usdcFormatted, morAllowance, morAllowanceFormatted, isUnlimitedAllowance }

// Approve (never use MAX_UINT256)
await sdk.approveMor(BigInt(10000e18))
```

### Inference

```typescript
// Simple
const response = await sdk.complete('Hello')

// With options
const response = await sdk.complete('Explain AI', {
  model: 'kimi-k2.5',
  systemPrompt: 'You are helpful',
  temperature: 0.7,
  maxTokens: 1000,
})

// Full API
const result = await sdk.createChatCompletion({
  model: 'kimi-k2.5',
  messages: [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' },
  ],
})

// Streaming
for await (const chunk of sdk.createChatCompletionStream({
  model: 'kimi-k2.5',
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '')
}

// Models
const models = await sdk.listModels()

// Health
const health = await sdk.healthCheck()
```

### Static Methods

```typescript
MorDiemSDK.generateMnemonic()       // 12 words
MorDiemSDK.generateMnemonic(256)    // 24 words
MorDiemSDK.isValidMnemonic(m)       // boolean
MorDiemSDK.fromMnemonic({ mnemonic, walletIndex })
```

## Low-Level Exports

```typescript
import {
  // Wallet
  generateNewMnemonic,
  isValidMnemonic,
  deriveWalletFromMnemonic,
  deriveWallet,
  getBalances,

  // Tokens
  swapEthForMor,
  swapUsdcForMor,
  approveMor,

  // Client
  MorpheusClient,
  createP2PClient,

  // Contracts
  CONTRACTS,
} from 'mor-diem-sdk'
```

## MorpheusClient

```typescript
const client = new MorpheusClient({
  baseUrl: 'http://127.0.0.1:8083',
})

await client.createChatCompletion({ model, messages })
client.createChatCompletionStream({ model, messages })
await client.listModels()
await client.healthCheck()
```

## Contracts

```typescript
CONTRACTS.MOR_TOKEN         // 0x7431aDa8a591C955a994a21710752EF9b882b8e3
CONTRACTS.DIAMOND_CONTRACT  // 0x6aBE1d282f72B474E54527D93b979A4f64d3030a
CONTRACTS.USDC              // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CONTRACTS.WETH              // 0x4200000000000000000000000000000000000006
CONTRACTS.UNISWAP_ROUTER    // 0x2626664c2603336E57B271c5C0b26F421741e481
```

## Types

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: [{ index: number, message: ChatMessage, finish_reason: string }]
  usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
}

interface Balances {
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
```
