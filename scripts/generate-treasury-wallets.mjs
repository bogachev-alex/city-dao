#!/usr/bin/env node
import { Keypair } from '@solana/web3.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DISTRICTS = [
  'Алатауский',
  'Алмалинский',
  'Ауэзовский',
  'Бостандыкский',
  'Жетысуский',
  'Медеуский',
  'Наурызбайский',
  'Турксибский',
];

function main() {
  const keypairs = {};

  for (const district of DISTRICTS) {
    const kp = Keypair.generate();
    keypairs[district] = {
      publicKey: kp.publicKey.toBase58(),
      secretKey: Array.from(kp.secretKey),
    };
  }

  const keysPath = join(ROOT, '.treasury-keys.json');
  if (existsSync(keysPath)) {
    console.log(`⚠️  ${keysPath} already exists. Aborting to prevent overwrite.`);
    console.log('   Delete it manually if you want to regenerate.');
    process.exit(1);
  }

  writeFileSync(keysPath, JSON.stringify(keypairs, null, 2), { mode: 0o600 });
  console.log(`✅ Generated ${DISTRICTS.length} treasury keypairs → ${keysPath}`);
  console.log('');
  console.log('Add these to your .env or seed data:');
  console.log('');

  for (const [district, data] of Object.entries(keypairs)) {
    console.log(`  ${district}: ${data.publicKey}`);
  }

  console.log('');
  console.log('⚠️  KEEP .treasury-keys.json SECURE — it contains private keys!');
  console.log('   Add .treasury-keys.json to .gitignore');
}

main();
