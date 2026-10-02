# Infrastructure

Version-controlled deployment configuration lives here. Secret values and generated TLS
configuration must never be committed.

- `nginx/g000st-staging.conf` routes the HTTPS staging hostname to the internal Next.js and API
  processes. Certificate files are managed and renewed by Certbot on the server.
- `nginx/g000st-media.conf` proxies signed media traffic to MinIO on `g000st-app` and restricts
  browser CORS to the production, staging, and approved local-development origins.
- `deploy/deploy-staging.sh` is the root-owned server entry point used by the manual GitHub
  Actions workflow. It validates artifacts, builds immutable releases, switches the `current`
  symlink, checks health, and rolls back automatically on failure.

## Connection geolocation

Staging uses the local DB-IP City Lite MMDB database (CC BY 4.0). No per-request
external lookup is made. Country and city are approximate; the admin pages include
the required [DB-IP attribution](https://db-ip.com).

On Ubuntu, install `libnginx-mod-http-geoip2` and `mmdb-bin`. Install
`deploy/update-geoip.sh` as `/usr/local/sbin/g000st-update-geoip` (mode 755), then
run it to download and validate the current monthly database. It replaces the database
atomically and preserves the previous database if a download or validation fails.
Install `nginx/g000st-geoip.conf` in `/etc/nginx/conf.d/` before applying the staging
site configuration. Run `nginx -t` before reloading. The geo headers overwrite client
headers and use `$remote_addr`, so this configuration assumes direct traffic to nginx;
if a CDN is introduced, first configure trusted real-IP sources.

Keep the API bound to `127.0.0.1` and set `TRUST_GEO_HEADERS=true` in its server-only
environment. Restart the API. Install the `systemd/g000st-geoip-update.*` units under
`/etc/systemd/system/`, run `systemctl daemon-reload`, and enable/start
`g000st-geoip-update.timer`. It checks daily for a new monthly release; nginx reloads
the changed database automatically. Geography is collected on authenticated presence
heartbeats and expires from dashboard results after 30 days.

## Manual staging deployment

The `Deploy staging` workflow can be started from the GitHub Actions page and accepts one target:
`web`, `api`, or `both`. It runs only from `main`, uses the protected `staging` environment, and
serializes deployments so two releases cannot update staging at the same time.

The `staging` GitHub Environment requires these secrets:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_USER`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`

It also uses the optional `DEPLOY_SSH_PORT` environment variable, which defaults to `22`.
The server key belongs to the restricted `g000st-deploy` user; never use a personal or root SSH
private key in GitHub Actions.
