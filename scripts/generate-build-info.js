import fs from 'fs';
import { execSync } from 'child_process';

let commit = 'v1.0.2-secure';
try {
  commit = execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim() || 'v1.0.2-secure';
} catch (e) {
  commit = 'v1.0.2-secure';
}

const info = {
  version: commit,
  buildTime: new Date().toISOString(),
  features: ['version-endpoint', 'hardcoded-secrets-removed'],
};

fs.writeFileSync(
  'src/lib/buildInfo.ts',
  `export const BUILD_INFO = ${JSON.stringify(info, null, 2)};\n`
);
