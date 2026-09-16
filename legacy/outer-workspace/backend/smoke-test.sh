#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://127.0.0.1:3001}"
APP_UNIFIED_URL="${APP_UNIFIED_URL:-http://127.0.0.1:3002}"
APP_LEGACY_URL="${APP_LEGACY_URL:-http://127.0.0.1:3003}"

parse_json_field() {
  node -e "const fs=require('fs');const t=fs.readFileSync(0,'utf8');const k=process.argv[1];try{const j=JSON.parse(t);process.stdout.write(String(j[k] ?? ''));}catch{process.stdout.write('');}" "$1"
}

echo "[1/7] WEB feed"
curl -s "$WEB_URL/feed" | head -c 200 >/dev/null

echo "[2/7] WEB generate-code"
resp=$(curl -s -X POST "$WEB_URL/generate-code" -H 'Content-Type: application/json' -d '{}')
code=$(echo "$resp" | parse_json_field code)
if [[ ${#code} -ne 50 ]]; then
  echo "FAIL: WEB generated code length is ${#code} (expected 50)"
  exit 1
fi

echo "[3/7] WEB check-code"
valid=$(curl -s -X POST "$WEB_URL/check-code" -H 'Content-Type: application/json' -d "{\"code\":\"$code\"}" | parse_json_field valid)
if [[ "$valid" != "true" ]]; then
  echo "FAIL: WEB check-code did not return valid=true"
  exit 1
fi

echo "[4/7] APP unified generate-code"
ucode=$(curl -s "$APP_UNIFIED_URL/generate-code" | parse_json_field code)
if [[ ${#ucode} -ne 50 ]]; then
  echo "FAIL: APP unified generated code length is ${#ucode} (expected 50)"
  exit 1
fi

echo "[5/7] APP unified chat route"
ustatus=$(curl -s -o /dev/null -w '%{http_code}' "$APP_UNIFIED_URL/chat")
if [[ "$ustatus" != "200" ]]; then
  echo "FAIL: APP unified /chat returned HTTP $ustatus"
  exit 1
fi

echo "[6/7] APP legacy health"
health_ok=$(curl -s "$APP_LEGACY_URL/health" | parse_json_field ok)
if [[ "$health_ok" != "true" ]]; then
  echo "FAIL: APP legacy /health did not return ok=true"
  exit 1
fi

echo "[7/7] APP legacy generate/check"
resp2=$(curl -s -X POST "$APP_LEGACY_URL/generate-code" -H 'Content-Type: application/json' -d '{}')
code2=$(echo "$resp2" | parse_json_field code)
if [[ ${#code2} -ne 50 ]]; then
  echo "FAIL: APP legacy generated code length is ${#code2} (expected 50)"
  exit 1
fi
valid2=$(curl -s -X POST "$APP_LEGACY_URL/check-code" -H 'Content-Type: application/json' -d "{\"code\":\"$code2\"}" | parse_json_field valid)
if [[ "$valid2" != "true" ]]; then
  echo "FAIL: APP legacy check-code did not return valid=true"
  exit 1
fi

echo "PASS: all backend smoke tests passed"
