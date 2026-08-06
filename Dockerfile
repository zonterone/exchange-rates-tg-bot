FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS prod-deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=192

# MultiTransfer hands out no session id: one is minted by loading their page in
# a real browser (docs/adr/0001). alpine has moved the binary between
# `chromium` and `chromium-browser`, so the link is resolved at build time and
# the build fails loudly if neither name is there
RUN apk add --no-cache chromium tini \
  && ln -s "$(command -v chromium-browser || command -v chromium)" /usr/local/bin/chromium
ENV CHROMIUM_PATH=/usr/local/bin/chromium

COPY --from=builder /app/dist ./
# the rates card is rendered by a native addon and needs the bundled fonts
COPY --from=prod-deps /app/node_modules/@resvg ./node_modules/@resvg
COPY assets ./assets

RUN mkdir -p ./db && chown -R node:node /app

VOLUME /app/db

# the bot needs no root: a mounted db volume must be writable by uid 1000
USER node

# node would be pid 1, and chromium's orphaned children reparent onto it —
# node reaps only what it spawned, so without an init they pile up as zombies
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "main.cjs"]
