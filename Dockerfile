# Use a imagem oficial do Node.js com Alpine para menor tamanho
FROM node:20-alpine AS base

# Instalações necessárias para o Prisma e dependências nativas
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copia os arquivos de package e instala TODAS as dependências (incluindo dev para o build)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Fase de build
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Build da aplicação Next.js
RUN npm run build

# Fase de execução
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Instala apenas dependências de produção para rodar a app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia o build gerado
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copia o Prisma Client gerado e o schema
COPY --from=builder /app/prisma ./prisma

# Ajusta permissões
RUN mkdir .next && chown nextjs:nodejs .next
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Comando de inicialização
CMD ["node", "server.js"]
