# Staking

## Core Concept

MOR stake = refundable deposit, not payment.

```
Traditional:  Pay $$ -> Use -> $$ gone
MOR DIEM:     Deposit MOR -> Use -> MOR returned
```

## Session Model

| Fact | Value |
|------|-------|
| 1 model | 1 session |
| 1 session | ~2 MOR deposit |
| Duration | 7 days |
| Usage | Unlimited |
| After expiry | MOR returns |

5 models = 5 sessions = ~10 MOR staked.

## Flow

1. **Approve** - One-time: allow Diamond contract to use MOR
2. **Chat** - Send message to model
3. **Auto-deposit** - SDK opens session, deposits ~2 MOR
4. **Use** - Unlimited inference for 7 days
5. **Release** - MOR returns after session ends

## Economics

| Item | Value |
|------|-------|
| Deposit/session | ~2 MOR |
| Duration | 7 days |
| Gas/session | ~0.0001 ETH |
| Usage limit | None |

## Contracts (Base Mainnet)

```
MOR Token: 0x7431aDa8a591C955a994a21710752EF9b882b8e3
Diamond:   0x6aBE1d282f72B474E54527D93b979A4f64d3030a
```

## Approval

Never use MAX_UINT256. Causes overflow.

```bash
bun run cli wallet approve 10000000000000000000000
```

## Session Renewal

- Auto-renews 1 hour before expiry
- Opens fresh 7-day session
- Old deposit returns to wallet

## FAQ

**Q: Not enough MOR for all models?**
A: Pick which models to use. Add more later.

**Q: Get MOR back early?**
A: No. Locked for 7 days.

**Q: Session fails?**
A: SDK retries automatically. Check balance and approval if persists.

**Q: Fixed deposit amount?**
A: No. ~2 MOR typical, varies by provider.
