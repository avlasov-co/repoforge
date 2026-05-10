#!/usr/bin/env bash
set -euo pipefail

npm install --offline || npm install
npm run compile
npm test
npm run package
