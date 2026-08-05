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

COPY --from=builder /app/dist ./
# the rates card is rendered by a native addon and needs the bundled fonts
COPY --from=prod-deps /app/node_modules/@resvg ./node_modules/@resvg
COPY assets ./assets

RUN mkdir -p ./db && chown -R node:node /app

VOLUME /app/db

# the bot needs no root: a mounted db volume must be writable by uid 1000
USER node

CMD ["node", "main.cjs"]
