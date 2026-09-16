# Infrastructure

Version-controlled deployment configuration lives here. Secret values and generated TLS
configuration must never be committed.

- `nginx/g000st-staging.conf` routes the staging hostname to the internal Next.js and API
  processes. TLS is added with Certbot only after the DNS record resolves to the web server.
