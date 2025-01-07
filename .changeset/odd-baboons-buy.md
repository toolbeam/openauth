---
"@openauthjs/openauth": patch
---

Adds support for refresh token reuse interval and reuse detection

Also fixes an issue with token invalidation, where removing keys while scanning
may cause some refresh tokens to be skipped (depending on storage provider.)