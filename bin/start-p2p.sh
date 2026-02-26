#!/bin/bash
# Start Morpheus P2P Infrastructure
#
# Requires MOR_MNEMONIC to be set
# Usage: MOR_MNEMONIC="your words here" ./bin/start-p2p.sh

set -e

cd "$(dirname "$0")/.."

if [ -z "$MOR_MNEMONIC" ]; then
    echo "❌ MOR_MNEMONIC environment variable required"
    echo "   Usage: MOR_MNEMONIC=\"word1 word2 ...\" ./bin/start-p2p.sh"
    exit 1
fi

echo "🔧 Setting up router credentials..."
bun run bin/setup-router.ts

echo ""
echo "🚀 Starting Morpheus Router (port 8082)..."
cd bin/morpheus
./morpheus-router &
ROUTER_PID=$!
cd ../..

# Wait for router to start
sleep 3

echo ""
echo "🔗 Starting Morpheus Proxy (port 8083)..."
bun run src/proxy/morpheus-proxy.mjs &
PROXY_PID=$!

# Wait for proxy to start
sleep 2

echo ""
echo "✅ P2P Infrastructure Running"
echo "   Router: http://localhost:8082 (PID: $ROUTER_PID)"
echo "   Proxy:  http://localhost:8083 (PID: $PROXY_PID)"
echo ""
echo "📝 To chat: bun run cli chat"
echo "   To stop: kill $ROUTER_PID $PROXY_PID"
echo ""

# Wait for both processes
wait
