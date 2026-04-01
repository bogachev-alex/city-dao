#!/usr/bin/env bash
# Build and deploy programs/crowdfunding to Solana devnet.
# Prerequisites: Solana CLI, Anchor 0.32.x, Rust, keypair at target/deploy/crowdfunding-keypair.json
#   matching declare_id! in programs/crowdfunding/src/lib.rs.
#
# First-time program id (if you rotated the key):
#   node scripts/generate-crowdfunding-keypair.mjs
#   node scripts/sync-crowdfunding-program-id.mjs
#   git add/commit updated sources, backup target/deploy/crowdfunding-keypair.json and GitHub secret.
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.cargo/bin:${HOME}/.local/share/solana/install/active_release/bin:${PATH}"

for cmd in solana anchor; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing $cmd in PATH. Install Solana (https://docs.solana.com/cli/install) and Anchor 0.32.x."
    exit 1
  fi
done

KP="target/deploy/crowdfunding-keypair.json"
if [[ ! -f "$KP" ]]; then
  echo "Missing $KP. Run: node scripts/generate-crowdfunding-keypair.mjs && node scripts/sync-crowdfunding-program-id.mjs"
  exit 1
fi

solana config set --url https://api.devnet.solana.com
DEPLOY_WALLET="${SOLANA_WALLET:-$HOME/.config/solana/id.json}"
solana config set --keypair "$DEPLOY_WALLET"

PAYER_ADDR="$(solana address)"
LAMP="$(solana balance --lamports | awk '{print $1}')"
# Program deploy on devnet typically needs ~1.95–2.2 SOL rent + fees; require ≥2 SOL.
MIN_LAMPORTS=2000000000
if [[ "${LAMP:-0}" -lt "$MIN_LAMPORTS" ]]; then
  echo "Deploy wallet has insufficient devnet SOL."
  echo "  Address: $PAYER_ADDR"
  echo "  Balance: ${LAMP:-0} lamports (need at least $MIN_LAMPORTS, ~2 SOL)"
  echo "Fund this address on devnet, or set SOLANA_WALLET=/path/to/funded-keypair.json and re-run."
  echo "Optional: TRY_AIRDROP=1 to attempt CLI airdrop (often rate-limited)."
  if [[ "${TRY_AIRDROP:-}" == "1" ]]; then
    solana airdrop 2 || true
    LAMP="$(solana balance --lamports | awk '{print $1}')"
  fi
  if [[ "${LAMP:-0}" -lt "$MIN_LAMPORTS" ]]; then
    exit 1
  fi
fi
echo "Deploy wallet OK: $PAYER_ADDR — $(solana balance)"

echo "Building crowdfunding program..."
anchor build -p crowdfunding

echo "Syncing IDL to frontend..."
cp -f target/idl/crowdfunding.json lib/web3/idl/crowdfunding.json
npm run idl:verify

echo "Deploying to devnet..."
anchor deploy -p crowdfunding --provider.cluster devnet --provider.wallet "$DEPLOY_WALLET"

PROG="$(solana-keygen pubkey "$KP")"
echo "Done. Program id: $PROG"
solana program show "$PROG" --url devnet
