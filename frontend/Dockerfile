FROM node:20-slim AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN npm config set registry https://registry.npmmirror.com \
  && corepack enable \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build:docker

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /var/www/html

EXPOSE 80
