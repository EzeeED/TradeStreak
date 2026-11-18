# TradeStreak: imagen de producción (API + web compilada)
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
# Subruta pública, p. ej. /app para dominio.com/app/dashboard
ARG BASE_PATH=/app
ENV BASE_PATH=$BASE_PATH
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/tradestreak.db
COPY package.json ./
COPY server/package.json server/
COPY --from=build /src/node_modules node_modules
COPY server/src server/src
COPY --from=build /src/web/dist web/dist
ARG BASE_PATH=/app
ENV BASE_PATH=$BASE_PATH
VOLUME /data
EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
