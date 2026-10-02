# =======================================================================
# Dockerfile برای اجرای پرتابل سامانه روی تمامی هاست‌ها (Runflare, VPS, Docker)
# =======================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# نصب وابستگی‌ها
COPY package*.json ./
RUN npm ci

# کپی کل سورس‌کد
COPY . .

# بیلد نسخه کامل فرانت‌اند و بک‌اند
RUN npm run build

# ----------------- مرحله اجرایی نهایی (Production Stage) -----------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# نصب وابستگی‌های اجرایی
COPY package*.json ./
RUN npm ci --only=production

# کپی خروجی بیلد و فایل‌های لازم
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

EXPOSE 3000

# اجرای سرور Node.js باندل‌شده
CMD ["node", "dist/server.cjs"]
