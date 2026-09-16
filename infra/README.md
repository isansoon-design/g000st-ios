# Infrastructure

Version-controlled deployment configuration lives here. Secret values and generated TLS
configuration must never be committed.

- `nginx/g000st-staging.conf` routes the HTTPS staging hostname to the internal Next.js and API
  processes. Certificate files are managed and renewed by Certbot on the server.
