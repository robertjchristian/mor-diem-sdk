# CLAUDE.md - mor-diem-sdk

> Agent context for mor-diem-sdk.

## Critical: The Two Pieces

There are TWO pieces. mor-diem-sdk is ONE of them:

| Piece | Port | Code | What It Does |
|-------|------|------|--------------|
| **OpenAI Translator** | 8083 | `src/proxy/morpheus-proxy.mjs` (mor-diem-sdk) | Converts OpenAI API calls to Morpheus format |
| **Morpheus Node** | 9081 | [Lumerin binary](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases) (external, ~56MB download) | Connects to P2P network, stakes MOR, talks to providers |

**Standalone mode:**
```
Your App → mor-diem-sdk Translator (8083) → Morpheus Node (9081) → AI Providers
                  ↑                                ↑
           separate process                   separate binary
```

**Embedded mode (proxy in same process as your app):**
```
┌─────────────────────────────────┐
│ Your App Process                │
│  Your Code → SDK → Translator   │ ──→ Morpheus Node (9081) → AI Providers
│         (all mor-diem-sdk)      │            ↑
└─────────────────────────────────┘      separate binary
```

**Connection is configured via env var:**
```bash
MORPHEUS_ROUTER_URL=http://localhost:9081  # default - you run the node locally
MORPHEUS_ROUTER_URL=http://1.2.3.4:9081    # point to remote node (if you have one)
```

**Users must either:**
1. **Download and run** the [Morpheus Node](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases) locally on port 9081
2. **Use api.mor.org** instead (pay USD, skip all of this)

There is **no public Morpheus Node**. You run it yourself or use api.mor.org.

## Confusing Names

Morpheus calls their binary `proxy-router`. We call our file `morpheus-proxy.mjs`. Both have "proxy" in the name. Ignore that. Just remember:
- **Ours (8083):** Translates API format
- **Theirs (9081):** Actually connects to the network

## Stack

- TypeScript / Bun
- CLI tooling

## Key Features

- MOR token staking (refundable deposits)
- OpenAI-compatible inference API
- Embeddable proxy (~500 lines)

## Gotchas

- **Must be fully self-contained** - no references to Synapse/Avatar/DRM3 internals
- Destined for open-source community release
- Needs excellent README and standalone docs for external developers
- Foundation layer - independent, nothing upstream

## Build Commands

```bash
bun install          # Install dependencies
bun run build        # Build to dist/ (ephemeral)
bun run release      # Build + copy to release/ (committed)
bun run lint         # Check linting
bun run lint:fix     # Auto-fix lint issues
bun run cli          # Run CLI
```

## Release Pattern

- `dist/` is gitignored (ephemeral build output)
- `release/` is tracked (blessed artifacts for git URL install)
- Always run `bun run release` before committing distribution changes

## Commit Guidelines

Write clear, professional commit messages:
- Use imperative mood ("add feature" not "added feature")
- First line: concise summary of what changed (50 chars or less)
- Body: explain the why and what, not the how
- No jokes, slang, or informal language in commits
- Examples of good commits:
  - `add wallet balance display to CLI`
  - `fix session timeout handling for P2P mode`
  - `update MOR token contract address for mainnet`

## Testing

```bash
bun test             # Run all tests
bun test wallet      # Run wallet tests only
bun test integration # Run integration tests (requires proxy)
```

### Test Wallet

The `.env` file contains a test wallet mnemonic. Derived address:

```
Address: 0xf5a8Ac2d50Bf0bcD8d800278FE5Cea5C000A05c1
```

This wallet is funded with:
- ETH (for gas on Base)
- MOR (for staking sessions)

**Staking costs:** ~2 MOR per model, refundable after 7 days.

Integration tests check 3 models × 2 MOR = ~6 MOR staked for testing.

### Test Structure

| File | Coverage |
|------|----------|
| `tests/wallet.test.ts` | Mnemonic generation, validation, HD derivation |
| `tests/sdk.test.ts` | SDK initialization, configuration |
| `tests/client.test.ts` | Client creation, model constants |
| `tests/integration.test.ts` | Live network tests (balances, models, inference) |

### Price Monitoring

Integration tests flag if model staking requires more than 2 MOR:
```
🚨 PRICE INCREASE DETECTED!
   Model xyz requires 5 MOR to stake
   Expected max: 2 MOR
```

Update `EXPECTED_MAX_STAKE_PER_MODEL` in `tests/integration.test.ts` if prices change.

## Terminology

- "mor-diem-sdk" = this repo (SDK + proxy + CLI), always lowercase with hyphens
- "MOR" = Morpheus token
- "consumer node" = Morpheus's [proxy-router binary](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node) (~56MB, download separately)
- "our proxy" = `morpheus-proxy.mjs` (embeddable, translates OpenAI API)
- "api.mor.org" = hosted by Morpheus (they run the consumer node, you pay USD)
- "provider" = runs AI models, earns MOR

## Architecture Deep Dive

```
Your App → SDK → morpheus-proxy (:8083) → morpheus-router (:9081) → AI Providers
                      ↓
                 .cookie file (auth)
```

### Components

| Component | Port | Role |
|-----------|------|------|
| **morpheus-proxy** | 8083 | OpenAI-compatible API, session management, model mapping |
| **morpheus-router** | 9081 | Blockchain ops, provider routing, staking sessions |

### Key Files

| File | Purpose |
|------|---------|
| `src/proxy/morpheus-proxy.mjs` | OpenAI-compatible proxy layer |
| `src/client/index.ts` | MorpheusClient - makes API calls to proxy |
| `src/index.ts` | MorDiemSDK - main entry point |
| `src/cli/mor-diem.ts` | CLI entry point |

### Authentication Flow

1. Morpheus Node creates `.cookie` file on first run
2. Proxy reads `.cookie` to authenticate with node
3. Proxy uses Basic auth: `Authorization: Basic <base64(cookie)>`
4. If `.cookie` missing/invalid → "invalid basic auth provided"

**Cookie file locations (checked in order):**
1. `$MORPHEUS_COOKIE_PATH` (env override)
2. `~/.morpheus/.cookie` (user home)

### Error Handling Philosophy

User-facing errors should be **actionable**, not internal:
- ❌ "invalid basic auth provided" → internal/confusing
- ✅ "Not staked - run setup first" → actionable

Translate these errors in SDK/CLI:
- `auth` errors → "not staked" / "router not configured"
- `session` errors → "not staked" / "need MOR deposit"
- `bid` errors → "not staked" / "no provider available"

### Model Testing

The `tests/models.test.ts` dynamically fetches all models from proxy and categorizes:
- ✅ **working** - model responds successfully
- ⬜ **needs_stake** - model requires MOR deposit (not an error!)
- ❌ **error** - actual infrastructure failures

**Important:** Needing stake is NOT an error. It's expected behavior for models you haven't deposited MOR for yet.

### Staking Economics

- ~2 MOR deposit per model session
- Deposit locks for 7 days
- Deposit returns to wallet after session expires
- Sessions auto-renew 1 hour before expiry

## Common Issues for Agents

### "invalid basic auth provided"
Router auth not configured. Need to:
1. Run morpheus-router to generate `.cookie`
2. Ensure proxy can read the cookie file
3. Check `MORPHEUS_COOKIE_PATH` env if needed

### "arithmetic underflow or overflow"
MOR allowance set to MAX_UINT256. Router calls `increaseAllowance()` which overflows.
Fix: Set reasonable allowance (e.g., 10,000 MOR)

### Tests show all models as "error"
Proxy likely not running or not configured. Start with:
```bash
bun run proxy  # Start proxy on 8083
```
