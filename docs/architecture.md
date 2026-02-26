# Architecture

## Two Approaches

| | MOR DIEM SDK | MOR API (api.mor.org) |
|-|--------------|----------------------|
| What | Your consumer node | Their consumer node |
| Auth | Wallet + MOR stake | API key |
| Economics | Deposit returns after 7 days | Payment consumed |
| Privacy | Maximum | They see requests |
| Setup | Run proxy + router | HTTP calls only |
| Cost | Near-zero (stake refunds) | Per-use fees |

## Stack (MOR DIEM SDK)

```
Your App
    ↓ OpenAI API
MOR DIEM Proxy (:8083)
    ↓ Morpheus Protocol
Lumerin Router (:9081)
    ↓ Base Mainnet
Morpheus P2P Network
```

## Components

| Component | Port | Role |
|-----------|------|------|
| Proxy | 8083 | OpenAI API, session mgmt |
| Router | 9081 | Blockchain ops, P2P |

## Economic Model

```
Traditional:  Pay $$ -> Use -> $$ gone
MOR DIEM:     Deposit MOR -> Use -> MOR returned (7 days)
```

Stake = refundable deposit, not payment.

## Files

| File | Purpose |
|------|---------|
| `src/proxy/morpheus-proxy.mjs` | OpenAI proxy |
| `src/wallet/` | Wallet management |
| `bin/morpheus/` | Router binary |

## Config

**MOR DIEM SDK (recommended):**
```bash
MOR_MNEMONIC="your seed phrase"
# Run: router on :9081, proxy on :8083
```

**MOR API (alternative):**
```bash
MOR_API_KEY=your-api-key
MORPHEUS_BASE_URL=https://api.mor.org/api/v1
```

## Capacity

```
1 stake (~2 MOR) = 1 session = 1 lane = rate-limited RPM
N stakes = N lanes = N× capacity
```
