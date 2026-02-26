# Architecture

## Why Two Components?

You need TWO things running to use mor-diem-sdk:

| Component | What It Is | Why You Need It |
|-----------|------------|-----------------|
| **morpheus-router** | Official Morpheus binary | Blockchain ops, P2P network, provider connections |
| **morpheus-proxy** | Our OpenAI wrapper | Translates OpenAI API → Router's weird API |

**You cannot embed this in your app.** Both must run as separate processes.

## The Stack

```
Your App (any language)
    ↓ Standard OpenAI API (POST /v1/chat/completions)
morpheus-proxy (:8083) ← Our code, OpenAI-compatible
    ↓ Custom Morpheus Protocol (session headers, model IDs, Basic auth)
morpheus-router (:9081) ← Official binary from Morpheus
    ↓ Base blockchain + P2P
AI Providers
```

## Why Can't I Just Use the Router Directly?

The router doesn't speak OpenAI API. It has a custom protocol:
- Requires `session_id` and `model_id` headers
- Uses Basic auth from a `.cookie` file
- Model names are blockchain hashes (e.g., `0xbb9e920d94ad3fa2...`)
- Sessions must be opened/renewed manually

Our proxy handles all of this, giving you a clean OpenAI-compatible API.

## What the Proxy Does

| Feature | Without Proxy | With Proxy |
|---------|---------------|------------|
| API format | Custom Morpheus headers | Standard OpenAI |
| Model names | Hex hashes | Human names (`kimi-k2.5`) |
| Sessions | Manual open/renew | Auto on first request |
| Auth | Read .cookie, Base64 encode | Just works |
| Session expiry | Track manually | Auto-renews 1hr before |

## Deployment Options

### Development (Local)

```bash
# Terminal 1: Start router
cd bin/morpheus && ./morpheus-router

# Terminal 2: Start proxy
bun run proxy

# Terminal 3: Your app
curl http://localhost:8083/v1/chat/completions ...
```

### Production (Docker)

You need to containerize both:

```dockerfile
# Option A: Two containers
- morpheus-router container (port 9081)
- morpheus-proxy container (port 8083) ← expose this

# Option B: Single container with both processes
- supervisor/s6 managing both processes
```

**Expose only the proxy (8083).** The router (9081) stays internal.

### Hosted Alternative

Don't want to run infrastructure? Use **[api.mor.org](https://api.mor.org)**:
- They run the router + proxy
- You just make HTTP calls
- Pay per use instead of staking

## Data Flow

```
1. Your app calls: POST /v1/chat/completions { model: "kimi-k2.5", messages: [...] }
2. Proxy looks up model ID: "kimi-k2.5" → "0xbb9e920d94ad3fa2..."
3. Proxy checks for active session, opens one if needed (stakes MOR)
4. Proxy forwards to router with: session_id, model_id, Basic auth headers
5. Router connects to provider via P2P
6. Response flows back through proxy to your app
```

## Files

| File | Purpose |
|------|---------|
| `src/proxy/morpheus-proxy.mjs` | Our OpenAI proxy |
| `bin/morpheus/morpheus-router` | Official router binary (download separately) |
| `bin/morpheus/.cookie` | Router auth credentials |
| `bin/morpheus/data/` | Router's blockchain state |

## Ports

| Port | Component | Expose? |
|------|-----------|---------|
| 8083 | morpheus-proxy | Yes - your apps connect here |
| 9081 | morpheus-router | No - internal only |

## Can I...

**Run just the SDK without proxy/router?**
No. The SDK is a client library. It needs the proxy running to talk to.

**Embed this in a serverless function?**
No. You need persistent processes (router + proxy).

**Use this from a browser?**
No. The proxy runs server-side. Your browser app would call your backend, which calls the proxy.

**Scale horizontally?**
Multiple proxy instances can share one router. Or run multiple router+proxy pairs.
