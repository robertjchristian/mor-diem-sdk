# Lessons Learned

## Critical

| Issue | Cause | Fix |
|-------|-------|-----|
| `overflow (0x11)` on session open | Allowance set to MAX_UINT256 | Use 10,000 MOR allowance instead |
| "no provider accepting session" | Router NaN scoring bug | Check logs for "score is not valid NaN" |
| "invalid basic auth" | Missing `.cookie` file | Run router first to generate it |

## Session Model

- 1 model = 1 session = 1 deposit (~2 MOR)
- 5 models = 5 sessions = ~10 MOR total
- Deposits refund after 7 days

## Auth Flow

1. Router creates `.cookie` on first run
2. Proxy reads `.cookie` for Basic auth
3. No cookie = no auth = no sessions

Cookie locations (checked in order):
1. `$MORPHEUS_COOKIE_PATH`
2. `~/.morpheus/.cookie`

## Ports

| Port | Service |
|------|---------|
| 8083 | SDK Proxy (OpenAI API) |
| 9081 | Router Web (blockchain ops) |
| 9082 | Router TCP (inference) |

## Endpoints

```
/blockchain/*           Router API
/v1/chat/completions    Inference
/v1/models              Model list
/health                 Health check
```

## Addresses (Base Mainnet)

```
Diamond: 0x6aBE1d282f72B474E54527D93b979A4f64d3030a
MOR:     0x7431aDa8a591C955a994a21710752EF9b882b8e3
```

## Gas

- Keep 0.01+ ETH on Base
- Session tx: ~0.0001 ETH
