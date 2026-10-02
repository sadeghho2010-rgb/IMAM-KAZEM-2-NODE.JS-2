# 🚀 راهنمای استقرار و راه‌اندازی سراسری (Universal Deployment Guide)

این پروژه به طور کاملاً **پرتابل (Portable)** طراحی شده و روی تمامی هاست‌های ابری، کانتینری، VPS و سرورهای محلی بدون خطا اجرا می‌شود.

---

## 📌 ۱. استقرار روی رانفلر (Runflare)

### حل خطای `Blocked request. This host is not allowed`:
این خطا مربوط به محافظت دامنه‌های مجاز در Vite بوده است. با تنظیم `allowedHosts: true` و `host: '0.0.0.0'` در `vite.config.ts` و `server.ts`، این مشکل به طور ریشه‌ای حل شده است.

### مراحل استقرار در Runflare:
1. در پنل کاربری رانفلر، یک **برنامه Node.js** جدید بسازید (یا از حالت Dockerfile استفاده کنید).
2. مخزن گیت‌هاب پروژه را به رانفلر متصل کنید.
3. در بخش **متغیرهای محیطی (Environment Variables)**، موارد زیر را وارد کنید:
   ```env
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=your-64-character-jwt-secret-key
   JWT_REFRESH_SECRET=your-64-character-jwt-refresh-secret-key
   ```
4. دستور بیلد (Build Command):
   ```bash
   npm run build
   ```
5. دستور اجرا (Start Command):
   ```bash
   npm start
   ```
6. پورت داخلی سرویس (Port): **3000**

---

## 📌 ۲. استقرار روی سرور مجازی (Ubuntu VPS) با PM2 و Nginx

### مرحله ۱: نصب پیش‌نیازها
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2
```

### مرحله ۲: کلون و بیلد پروژه
```bash
cd /var/www
git clone https://github.com/your-username/your-repo.git madrasah-app
cd madrasah-app
npm install
npm run build
```

### مرحله ۳: تنظیم متغیرهای محیطی
فایل `.env` را در ریشه پروژه بسازید:
```bash
cp .env.example .env
nano .env
```

### مرحله ۴: اجرای سرویس با PM2
```bash
pm2 start dist/server.cjs --name "madrasah-app"
pm2 save
pm2 startup
```

### مرحله ۵: تنظیم Nginx و SSL رایگان
فایل `/etc/nginx/sites-available/madrasah` را ایجاد کنید:
```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
فعال‌سازی کانفیگ و نصب SSL:
```bash
sudo ln -s /etc/nginx/sites-available/madrasah /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

## 📌 ۳. استقرار روی Railway

1. پروژه را از گیت‌هاب به Railway متصل کنید (`New Project` -> `Deploy from GitHub repo`).
2. ریل‌وی به طور خودکار `Dockerfile` را تشخیص داده و پروژه را بیلد می‌کند.
3. در بخش **Variables** متغیرهای `JWT_SECRET` و `JWT_REFRESH_SECRET` و متغیرهای دیتابیس را تعریف نمایید.
4. پورت `3000` به عنوان پورت پیش‌فرض شناسایی می‌شود.

---

## 📌 ۴. استقرار روی Vercel

1. در Vercel روی `Add New Project` کلیک کرده و مخزن را انتخاب کنید.
2. فریم‌ورک را روی `Vite` بگذارید.
3. متغیرهای محیطی را در تنظیمات پروژه وارد کنید.
4. دستور بیلد: `npm run build`
5. پوشه خروجی: `dist`

---

## 📌 ۵. اجرای محلی (Local Development)

```bash
# ۱. نصب پکیج‌ها
npm install

# ۲. ایجاد فایل تنظیمات
cp .env.example .env

# ۳. اجرای سرور توسعه با لود زنده
npm run dev

# یا اجرای نسخه Production نهایی روی سیستم خود:
npm run build
npm start
```
سپس مرورگر خود را باز کرده و به نشانی `http://localhost:3000` مراجعه نمایید.
