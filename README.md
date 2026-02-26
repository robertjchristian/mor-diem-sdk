

<h2 align="center">mor-diem-sdk</h2>

<p align="center">
  <strong>Morpheus consumer node with SDK and CLI</strong>
</p>

<p align="center">
  <img src="assets/mor-diem.png" alt="mor-diem-sdk" width="600">
</p>




## Morpheus Consumer Node

This is a **Morpheus consumer node** - the same infrastructure that powers [api.mor.org](https://api.mor.org).

- **[api.mor.org](https://api.mor.org)** - A hosted gateway in front of a consumer node. Get an API key, pay USD.
- **mor-diem-sdk** - Run your own consumer node. Stake MOR tokens (refundable), get unlimited inference on one stream for a given model for the period agreed upon at time of stake.

Use mor-diem-sdk embedded in any app, or put your own gateway in front of it.

**Key difference:** Your MOR stake is a **refundable deposit**, not a payment. Tokens lock for 7 days, then return to you.

## Installation

### As a Dependency

```bash
npm install mor-diem-sdk
```

Then import in your code:

```typescript
import { MorDiemSDK } from 'mor-diem-sdk'

const sdk = new MorDiemSDK({
  mnemonic: process.env.MOR_MNEMONIC,
})

// Check balances
const balances = await sdk.getBalances()
console.log(`MOR: ${balances.morFormatted}`)

// Make inference call
const response = await sdk.complete('Hello from my app!')
```

---

## Quick Start (Local Development)

### First Time? Just Run:

```bash
bun install
bun run cli
```

The CLI will guide you through wallet setup. You'll need:
- ~0.01 ETH on Base (for gas, ~$0.02)
- ~5 MOR tokens (for deposits, ~$3 at current prices)

### Already Configured?

```bash
# Interactive chat
bun run cli chat

# Quick inference
bun run cli complete "Hello, world!"
```

### Programmatic Usage

```typescript
import { MorDiemSDK } from 'mor-diem-sdk'

const sdk = new MorDiemSDK({
  mnemonic: process.env.MOR_MNEMONIC,
})

const response = await sdk.complete('Explain quantum computing')
console.log(response)
```

## Architecture

```
Your App -> mor-diem-sdk proxy (:8083) -> Morpheus Router (:9081) -> AI Providers
```

| Component | Port | Role |
|-----------|------|------|
| mor-diem-sdk proxy | 8083 | OpenAI-compatible API, session management |
| Morpheus Router | 9081 | Blockchain operations, provider routing |

## Available Models

| Model | Notes |
|-------|-------|
| `kimi-k2.5` | General reasoning (recommended) |
| `kimi-k2.5:web` | Web search enabled |
| `kimi-k2-thinking` | Extended reasoning |
| `glm-4.7` / `glm-4.7-flash` | GLM models |
| `glm-5` | Latest GLM |
| `hermes-4-14b` | Hermes instruct |
| `gpt-oss-120b` | Open-source GPT |
| `MiniMax-M2.5` | MiniMax model |

Models are dynamically refreshed from the blockchain.

## CLI Commands

```bash
# Setup & Chat
bun run cli              # First-run setup + chat
bun run cli chat         # Interactive chat
bun run cli setup        # Re-run setup wizard

# Wallet
bun run cli wallet generate      # Generate new wallet
bun run cli wallet balance       # Check balances
bun run cli wallet approve       # Approve MOR for deposits

# Inference
bun run cli models              # List models
bun run cli complete "message"  # Quick test
bun run cli health              # Check connectivity
```

### Chat Commands

| Command | Description |
|---------|-------------|
| `/help` | Show commands |
| `/model` | Switch model |
| `/wallet` | Check balance |
| `/status` | Session info |
| `/clear` | Clear history |
| `/exit` | Exit |

## Configuration

Config is stored in `~/.mor-diem/config` (created by setup wizard).

### Wallet Options

| Option | Use Case |
|--------|----------|
| Mnemonic | Dev/testing - derive multiple wallets from one seed |
| Private Key | Production - single wallet, direct control |

```typescript
// Mnemonic - derive wallet 0, 1, 2... from one seed
new MorDiemSDK({ mnemonic: '...', walletIndex: 0 })

// Private key - single wallet
new MorDiemSDK({ privateKey: '0x...' })
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MOR_MNEMONIC` | BIP39 seed phrase |
| `MOR_PRIVATE_KEY` | Single wallet private key (alternative to mnemonic) |
| `MOR_WALLET_INDEX` | Derivation index for mnemonic (default: 0) |
| `MOR_API_KEY` | API key (gateway mode) |
| `MOR_BASE_URL` | Custom proxy URL |

## Documentation

- **[Architecture](docs/architecture.md)** - System design and component overview
- **[Staking Guide](docs/staking.md)** - How MOR deposits work, economics, best practices
- **[SDK API Reference](docs/sdk-api.md)** - Full TypeScript API documentation
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions
- **[Lessons Learned](docs/lessons-learned.md)** - Integration insights and gotchas
- **[Pricing Comparison](docs/pricing-comparison.md)** - Morpheus vs traditional APIs
- **[Builder Guide](docs/builder-guide.md)** - Comprehensive guide for operators

## Running the Proxy Stack

For P2P mode, you need the local proxy stack running:

```bash
# Start Morpheus router (connects to Base blockchain)
cd bin/morpheus && ./morpheus-router &  # Port 9081

# Start MOR DIEM proxy (OpenAI-compatible layer)
bun run src/proxy/morpheus-proxy.mjs &  # Port 8083
```

## Security

- **Never commit mnemonics** - Use environment variables or the config file
- **Config file is protected** - `~/.mor-diem/config` is readable only by you (mode 0600)
- **Use a dedicated wallet** - Don't use your main holdings for inference
- **Approve reasonable amounts** - Don't use MAX_UINT256 for approvals

## Tests

```bash
bun test                     # Run all tests
bun test tests/wallet.test.ts    # Wallet tests only
bun test tests/integration.test.ts  # Live network tests
```

### Test Coverage

| Suite | Description |
|-------|-------------|
| `wallet.test.ts` | BIP39 mnemonic generation, validation, HD derivation |
| `sdk.test.ts` | SDK initialization, configuration, static methods |
| `client.test.ts` | Client creation, available models |
| `integration.test.ts` | Live tests: balances, proxy health, model inference |

### Integration Tests

Integration tests run against live Base mainnet and the local proxy. They require:
- `MOR_MNEMONIC` environment variable set
- Local proxy running (`bun run proxy`)

Tests automatically handle:
- Checking wallet balances
- Listing available models
- Testing inference on multiple models
- **Price monitoring:** Flags if staking costs exceed 2 MOR per model

## License

UNLICENSED (Proprietary)

---

**Disclaimer:** This SDK interacts with blockchain smart contracts. Always test with small amounts first.
