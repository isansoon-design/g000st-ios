#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

# DB-IP City Lite (CC BY 4.0). UI attribution: https://db-ip.com
# Install as /usr/local/sbin/g000st-update-geoip; run daily using the timer.
destination=/var/lib/g000st/geoip
mkdir -p "$destination"
exec 9>"$destination/update.lock"
flock -n 9 || exit 0
month="${1:-$(date -u +%Y-%m)}"
[[ "$month" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || exit 2
if [[ -s "$destination/dbip-city-lite.mmdb" && -f "$destination/release-month" && "$(cat "$destination/release-month")" == "$month" ]]; then
  exit 0
fi
temporary="$(mktemp -d "$destination/.update.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT
curl --fail --location --silent --show-error --retry 3 --connect-timeout 15 --max-time 600 \
  "https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz" -o "$temporary/city.mmdb.gz"
gzip -dc "$temporary/city.mmdb.gz" > "$temporary/city.mmdb"
# Reject corrupt or incompatible databases before replacing the working file.
mmdblookup --file "$temporary/city.mmdb" --ip 8.8.8.8 country iso_code | grep -q '"US"'
chmod 644 "$temporary/city.mmdb"
mv "$temporary/city.mmdb" "$destination/dbip-city-lite.mmdb"
printf '%s\n' "$month" > "$destination/release-month"
printf 'Installed DB-IP City Lite %s\n' "$month"
