# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

# Evita estouro de heap do Node durante o tsc em droplets com pouca memoria.
ENV NODE_OPTIONS=--max-old-space-size=3072

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Arquivos usados no OCR e PDFs de entrada processados pela aplicação.
COPY *.traineddata ./
COPY *.pdf ./

RUN mkdir -p /app/Output

USER node

CMD ["node", "dist/index.js"]
