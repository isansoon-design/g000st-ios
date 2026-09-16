# Legacy outer workspace

This directory preserves the source material that existed in `/Users/moudy/Desktop/g000st`
before the monorepo became the workspace root on 2026-09-16.

The three client-provided HTML files are already preserved in `archive/client-source` and are
not duplicated here. Generated dependencies and build output are intentionally excluded.

The following sensitive or stateful files are also intentionally excluded from Git and kept in
the owner's restricted local backup instead:

- `.env` files
- Firebase service-account JSON files
- the legacy SQLite database and user data
- `codes.json`
