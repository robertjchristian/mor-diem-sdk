#!/usr/bin/env bun
/**
 * Setup Morpheus Node
 *
 * Downloads the proxy-router binary from Morpheus releases.
 * This is required to run mor-diem-sdk locally (staking MOR, not using api.mor.org).
 */

import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const MORPHEUS_DIR = join(homedir(), '.morpheus')
const BINARY_NAME = process.platform === 'win32' ? 'proxy-router.exe' : 'proxy-router'
const BINARY_PATH = join(MORPHEUS_DIR, BINARY_NAME)

const RELEASES_URL =
	'https://api.github.com/repos/MorpheusAIs/Morpheus-Lumerin-Node/releases/latest'

interface Asset {
	name: string
	browser_download_url: string
}

interface Release {
	tag_name: string
	assets: Asset[]
}

function getPlatformAssetPattern(): RegExp {
	const platform = process.platform
	const arch = process.arch

	// Asset names look like: mac-arm64-morpheus-router-5.14.0
	if (platform === 'darwin') {
		const macArch = arch === 'arm64' ? 'arm64' : 'x64'
		return new RegExp(`mac-${macArch}-morpheus-router-`)
	} else if (platform === 'linux') {
		const linuxArch = arch === 'arm64' ? 'arm64' : 'x86_64'
		return new RegExp(`linux-${linuxArch}-morpheus-router-`)
	} else if (platform === 'win32') {
		return /win-x64-morpheus-router-.*\.exe$/
	}
	throw new Error(`Unsupported platform: ${platform} ${arch}`)
}

async function main() {
	console.log('🔧 Setting up Morpheus Node...\n')

	// Check if already installed
	if (existsSync(BINARY_PATH)) {
		console.log(`✅ Morpheus Node already installed at ${BINARY_PATH}`)
		console.log('   To reinstall, delete it and run this script again.\n')
		return
	}

	// Create directory
	if (!existsSync(MORPHEUS_DIR)) {
		mkdirSync(MORPHEUS_DIR, { recursive: true })
		console.log(`📁 Created ${MORPHEUS_DIR}`)
	}

	// Fetch latest release
	console.log('📡 Fetching latest release from GitHub...')
	const releaseRes = await fetch(RELEASES_URL)
	if (!releaseRes.ok) {
		throw new Error(`Failed to fetch releases: ${releaseRes.status}`)
	}
	const release: Release = await releaseRes.json()
	console.log(`   Found ${release.tag_name}`)

	// Find matching asset
	const assetPattern = getPlatformAssetPattern()
	const asset = release.assets.find((a) => assetPattern.test(a.name))
	if (!asset) {
		console.error(`\n❌ No binary found for ${process.platform} ${process.arch}`)
		console.error(`   Looking for pattern: ${assetPattern}`)
		console.error(`   Available assets: ${release.assets.map((a) => a.name).join(', ')}`)
		console.error(`\n   Download manually from:`)
		console.error(`   https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases\n`)
		process.exit(1)
	}

	// Download binary
	console.log(`📥 Downloading ${asset.name}...`)
	const binaryRes = await fetch(asset.browser_download_url)
	if (!binaryRes.ok) {
		throw new Error(`Failed to download: ${binaryRes.status}`)
	}
	const binaryData = await binaryRes.arrayBuffer()
	await Bun.write(BINARY_PATH, binaryData)
	console.log(`   Saved to ${BINARY_PATH}`)

	// Make executable
	if (process.platform !== 'win32') {
		chmodSync(BINARY_PATH, 0o755)
		console.log('   Made executable')
	}

	console.log('\n✅ Morpheus Node installed!\n')
	console.log('To start it:')
	console.log(`   ${BINARY_PATH}\n`)
	console.log('It will:')
	console.log('   - Listen on port 9081')
	console.log('   - Create ~/.morpheus/.cookie for authentication')
	console.log('   - Manage your MOR staking and sessions\n')
}

main().catch((err) => {
	console.error('❌ Setup failed:', err.message)
	process.exit(1)
})
