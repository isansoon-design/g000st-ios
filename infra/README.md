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
