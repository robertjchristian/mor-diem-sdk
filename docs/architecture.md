# Architecture

## The Simple Version

```
Your App → Our Proxy → Lumerin Router → AI Providers
```

**Our proxy** (`morpheus-proxy.mjs`) translates OpenAI API calls to Morpheus protocol.

**Lumerin router** is the official Morpheus node. It handles blockchain, P2P, staking. You need access to one:
- Run locally (download binary)
- Point `MORPHEUS_ROUTER_URL` to a hosted one
- Use [api.mor.org](https://api.mor.org) (they run everything for you)

## Can I Embed the Proxy?

**Yes.** The proxy is just a Node.js HTTP server. You can:
- Run it as a separate process (current approach)
- Import and start it in your app's process
- Use the handler directly without HTTP

Currently it auto-starts on import. To embed, you'd refactor to export a `startProxy()` function.

## What Does Each Piece Do?

| Component | Code | What It Does |
|-----------|------|--------------|
| **Your app** | Yours | Makes OpenAI-style API calls |
| **Our proxy** | `src/proxy/morpheus-proxy.mjs` | Translates API, manages sessions |
| **Lumerin router** | Official binary | Blockchain ops, P2P network |

## Configuration

**Pick one approach:**

### Option A: Environment Variables (recommended)

```bash
# .env
MOR_MNEMONIC="your seed phrase"
MORPHEUS_ROUTER_URL="http://localhost:9081"  # or remote
```

### Option B: CLI Config File

The CLI saves to `~/.mor-diem/config`:
```json
{
  "mnemonic": "your seed phrase",
  "walletIndex": 0,
  "mode": "p2p"
}
```

Env vars override the config file.

## Router Options

### Local Morpheus Node (Full Control)

Download the [Morpheus Node](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases), run it locally.

```bash
./morpheus-router  # Creates .cookie, manages your wallet
```

### Remote Router

If someone hosts a router you trust:

```bash
MORPHEUS_ROUTER_URL="https://router.example.com:9081"
```

Note: Auth may be different for remote routers.

### Hosted (api.mor.org)

Don't want to run anything? Use the hosted gateway:

```bash
MOR_API_KEY="your-api-key"  # From app.mor.org
# No router needed - they run everything
```

## Data Flow

```
1. Your app: POST /v1/chat/completions { model: "kimi-k2.5", ... }
2. Proxy: Look up model ID, check/open session
3. Proxy: Forward to router with session headers
4. Router: Connect to provider via P2P
5. Provider: Generate response
6. Response flows back through the chain
```

## Ports

| Port | Component | Notes |
|------|-----------|-------|
| 8083 | Our proxy | Your app connects here |
| 9081 | Lumerin router | Proxy connects here |

## FAQ

**Do I need Docker?**
No. Two Node.js processes (or one if you embed the proxy).

**Can I use serverless?**
The proxy needs to maintain session state. Traditional serverless (cold starts) won't work well. A persistent container or VM is better.

**Can I scale horizontally?**
Multiple app instances can share one proxy. Multiple proxies can share one router. Or run independent stacks.
