# Pricing Comparison

> Last updated: February 2026. Prices change - verify current rates.

## Different Models, Different Math

| | Traditional API | Morpheus |
|-|-----------------|----------|
| Pricing unit | Per token | Per time (7-day session) |
| Capital | Spent permanently | Refundable deposit |
| Scales with | Usage volume | Number of concurrent streams |

**These are fundamentally different models.** Direct comparison only makes sense for continuous, high-volume usage.

## When Comparison Makes Sense

Morpheus charges per-time. To compare fairly, you must estimate tokens used over the session period.

**Continuous operation example:**
- 1 request/second, 500 tokens/request average
- 7 days = 604,800 seconds
- ~302M tokens over 7 days

At those volumes, traditional APIs cost thousands. Morpheus costs ~$1 deposit (returned).

## Realistic Scenarios

### Scenario A: Light Usage (1k requests/day)

| | Traditional | Morpheus |
|-|-------------|----------|
| Tokens/week | ~3.5M | Unlimited |
| Cost | ~$35-100 | ~$1 deposit |
| Returned | $0 | ~$1 |

Winner: Morpheus if you're using multiple models. Traditional if sporadic.

### Scenario B: Moderate Usage (10k requests/day)

| | Traditional | Morpheus |
|-|-------------|----------|
| Tokens/week | ~35M | Unlimited |
| Cost | ~$350-1000 | ~$1 deposit |
| Returned | $0 | ~$1 |

Winner: Morpheus clearly.

### Scenario C: Heavy/Continuous (100k+ requests/day)

Traditional APIs become prohibitively expensive. Morpheus is essentially free after deposit.

## Honest Assessment

**Morpheus wins when:**
- Running continuously or near-continuously
- High token volume (10k+ requests/day)
- Cost-sensitive operations
- You have MOR to stake

**Traditional APIs win when:**
- Sporadic, low-volume usage
- Need specific proprietary models (GPT-4, Claude)
- Don't want to manage staking/sessions
- Need SLA guarantees
- Usage is unpredictable

## The Real Difference

Traditional: Pay-as-you-go. Good for variable, low usage.

Morpheus: Fixed cost per time window. Good for predictable, high usage.

## Current Pricing Reference

**Morpheus (Feb 2026):**
- ~2 MOR deposit per model (~$1 at current prices)
- 7-day session, unlimited tokens
- Deposit returned after session

**Traditional (approximate, verify current):**
- GPT-4 class: $10-30/M tokens
- Claude: $8-15/M tokens
- Open models: $0.10-2/M tokens

## Capital Efficiency

With Morpheus, your capital works for you:

```
10 MOR staked = 5 model sessions = 7 days unlimited inference = 10 MOR returned
Actual cost: ~$0.10 gas
```

With traditional APIs, capital is consumed:

```
$5 spent = ~100k-500k tokens = $0 returned
```

But this only matters if you're actually using those tokens. Don't stake MOR for models you won't use heavily.
