FROM node:24-bookworm-slim AS node
FROM mcr.microsoft.com/playwright:v1.55.0-noble
# All project JavaScript runs on the same Node major as CI, including browser checks.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN npm install --prefix /opt/pw --no-audit --no-fund playwright@1.55.0
