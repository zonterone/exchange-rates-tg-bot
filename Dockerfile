FROM node:current-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/dist ./

RUN mkdir -p ./db

VOLUME /usr/src/app/db

CMD ["node", "main.js"]
