# Builder Guide

## Core Concepts

| Traditional API | Morpheus |
|-----------------|----------|
| Pay per token | Deposit MOR, get it back |
| API key | Session (time-based rental) |
| Unlimited concurrency | 1 stream per session |
| Pay more to scale | More sessions = more MOR |

## Two Paths

**Gateway (Easy):** API key, pay USD, token-based pricing.

**Direct (Full Control):** Consumer node, stake MOR, time-based sessions.

| | Gateway | Direct |
|-|---------|--------|
| Access | API key | On-chain sessions |
| Payment | USD or MOR | MOR stake |
| Pricing | Per token | Per time |
| Complexity | Low | High |

## Session Model

```
Stake MOR -> Session opens -> Use for 7 days -> MOR returns
```

1 session = 1 model = 1 concurrent stream = ~2 MOR deposit.

## Terms

| Term | Meaning |
|------|---------|
| MOR | Token staked to access compute |
| Provider | Node offering GPU |
| Session | Time-based rental (up to 7 days) |
| Stream | 1 concurrent inference lane |
| Consumer Node | Software managing sessions |

## Why Stake Model?

```
Token-based:  1M tokens at $0.01 = $10,000 gone
Time-based:   7-day session = ~$1 deposit = $1 returned
```

Heavy workloads = massive savings with Morpheus.

## Scaling

Need more capacity? More sessions.

```
1 session  = 1 lane  = X RPM
5 sessions = 5 lanes = 5X RPM
```

Each session = separate stake.

## Integration Patterns

**Simple:** Use SDK, it handles sessions automatically.

```typescript
const sdk = new MorDiemSDK({ mnemonic })
const response = await sdk.complete('Hello')
```

**Advanced:** Use MorpheusClient for direct control.

```typescript
const client = new MorpheusClient({ baseUrl })
const response = await client.createChatCompletion({
  model: 'kimi-k2.5',
  messages: [{ role: 'user', content: 'Hello' }]
})
```

## Models

| Model | Notes |
|-------|-------|
| `kimi-k2.5` | General (recommended) |
| `kimi-k2.5:web` | Web search |
| `kimi-k2-thinking` | Extended reasoning |
| `glm-4.7-flash` | Fast |
| `glm-4.7` | Full |
| `glm-5` | Latest GLM |

## Economics

| Item | Value |
|------|-------|
| Stake/session | ~2 MOR |
| Duration | 7 days |
| Usage | Unlimited |
| Return | Full refund |

## Contracts (Base)

```
MOR:     0x7431aDa8a591C955a994a21710752EF9b882b8e3
Diamond: 0x6aBE1d282f72B474E54527D93b979A4f64d3030a
```

## FAQ

**Q: Multiple models?**
A: Each model = separate session = separate stake.

**Q: Run out of MOR?**
A: Wait for sessions to expire (7 days), MOR returns.

**Q: Concurrency limit?**
A: 1 stream per session. More sessions = more concurrency.

**Q: Provider goes down?**
A: SDK retries with different provider automatically.
