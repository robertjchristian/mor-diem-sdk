# Pricing Comparison

## Model Difference

| | Traditional API | Morpheus |
|-|-----------------|----------|
| Unit | Per token | Per time |
| Capital | Spent | Refundable |
| Entry | $0 | ~$1/model/week |
| Heavy use | Scales linearly | Flat |

## Example: 1M Tokens / 7 Days

| Provider | Cost | Returned |
|----------|------|----------|
| OpenRouter (GPT-4 class) | ~$30 | $0 |
| OpenRouter (Claude) | ~$15 | $0 |
| Morpheus | ~$1 deposit | ~$1 |

Net Morpheus cost: gas only (~$0.10).

## When Morpheus Wins

- High throughput
- Long sessions
- Cost-sensitive
- Have MOR to stake

## When Traditional Wins

- Low/sporadic usage
- Need specific model
- Don't want staking
- Need SLA

## Session Math

```
1 session = ~2 MOR = 7 days unlimited = 1 stream
```

Multiple models = multiple sessions.

## Capital Efficiency

10 MOR (~$5):
- Run 5 models for 7 days
- Unlimited inference
- Get 10 MOR back
- Actual cost: ~$0.10 gas

$5 on OpenRouter:
- ~100k tokens
- Gone
