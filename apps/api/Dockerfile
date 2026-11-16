# Node and native dependencies remain on Debian/glibc; no musl/Alpine migration.
FROM node:22.23.5-trixie-slim@sha256:68c76cfad89921b927eae28ba21407475e29d0ce450afcdbe70c1532db042b64 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# The entire backend suite can run on the same Node/glibc build environment.
FROM build AS verify
COPY jest.config.cjs ./
COPY test ./test
COPY db ./db
ENV HOME=/tmp
USER 10001:10001
CMD ["npm", "run", "test:cov"]

FROM node:22.23.5-trixie-slim@sha256:68c76cfad89921b927eae28ba21407475e29d0ce450afcdbe70c1532db042b64 AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:cb87acc574abe719b6e5c547384defa2f7b1f24af9605d3f618cf852495d8be2 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/local/LICENSE /usr/share/doc/nodejs/LICENSE
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/package.json ./package.json
COPY --from=build /app/dist ./dist
USER 10001:10001
EXPOSE 3000
# Exec form is mandatory: the runtime deliberately has no shell/package manager.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD ["/usr/local/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["/usr/local/bin/node", "dist/main.js"]
