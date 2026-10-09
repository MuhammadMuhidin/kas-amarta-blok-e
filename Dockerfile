# Builder stage
FROM node:22-alpine AS builder

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG GIT_COMMIT_MESSAGE

WORKDIR /app

# Install all deps (needed for build)
COPY package*.json ./
RUN npm install

# Copy app source + scripts + env
COPY . .

# Build app (needs env vars for Supabase config)
# With output: 'standalone', Next.js generates minimal runtime in .next/standalone
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_BRANCH=$GIT_BRANCH
ENV COMMIT_MESSAGE=$GIT_COMMIT_MESSAGE
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy standalone output (much smaller than .next + node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
