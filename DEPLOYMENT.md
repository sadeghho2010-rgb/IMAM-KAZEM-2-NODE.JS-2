# 🚀 راهنمای جامع استقرار در لیارا (Liara Deployment Guide)

این پروژه برای استقرار بی‌دردسر، پرسرعت و پایدار بر روی **سکوی ابری لیارا (Liara)** بهینه‌سازی شده است. تمام تنظیمات پورت، روت‌ها، فایل‌های استاتیک و لاگر با پلتفرم Node.js لیارا هماهنگ هستند.

---

## 📌 ۱. استقرار مستقیم روی سکوی ابری لیارا (پیشنهاد اصلی)

### پیکربندی خودکار با `liara.json`:
فایل پیکربندی `liara.json` در ریشه پروژه قرار دارد:
```json
{
  "platform": "node",
  "port": 3000,
  "app": "madrasah-app"
}
```

### روش الف: استقرار سریع با Liara CLI (خط فرمان)
۱. نصب ابزار Liara CLI در سیستم خود:
```bash
npm install -g @liara/cli
```
۲. ورود به حساب کاربری لیارا:
```bash
liara login
```
۳. ایجاد برنامه در کنسول لیارا (از نوع Node.js) با نام `madrasah-app` (یا نام دلخواه شما).

۴. استقرار پروژه با یک دستور ساده:
```bash
liara deploy
```

---

### روش ب: استقرار از طریق پنل کاربری لیارا (Git / GitHub)
۱. در پنل کاربری لیارا به آدرس [console.liara.ir](https://console.liara.ir) بروید.
۲. یک برنامه جدید با پلتفرم **NodeJS** بسازید.
۳. در بخش **استقرار از گیت‌هاب**، مخزن گیت‌هاب پروژه را متصل کرده و برنچ اصلی (`main`) را انتخاب نمایید.
۴. دستور بیلد (Build Command):
   ```bash
   npm run build
   ```
۵. دستور اجرا (Start Command):
   ```bash
   npm start
   ```
۶. پورت برنامه: **3000**

---

## ⚙️ ۲. تنظیم متغیرهای محیطی در لیارا (Environment Variables)

در داشبورد برنامه لیارا، به بخش **تنظیمات برنامه ⬅️ متغیرهای محیطی** رفته و مقادیر زیر را وارد کنید:

| نام متغیر | مقدار پیشنهادی | توضیحات |
|---|---|---|
| `NODE_ENV` | `production` | فعال‌سازی بهینه‌سازی‌های پروداکشن |
| `PORT` | `3000` | پورت داخلی سرور اکسپرس |
| `JWT_SECRET` | رشته ۶۴ کاراکتری امن | کلید رمزنگاری توکن‌های دسترسی |
| `JWT_REFRESH_SECRET` | رشته ۶۴ کاراکتری امن مجزا | کلید امضای ریفرش‌توکن |
| `ALLOWED_ORIGIN` | `https://madrasah-app.liara.run` | دامنه برنامه در لیارا برای CORS |

---

## 🗄️ ۳. اتصال به دیتابیس MySQL در لیارا (اختیاری و پیشنهادی)

اگر مایلید از دیتابیس رابطه‌ای مدیریت‌شده لیارا استفاده کنید:
۱. در کنسول لیارا، یک **دیتابیس ابری MySQL** ایجاد کنید.
۲. اطلاعات اتصال داده‌شده توسط لیارا را در بخش متغیرهای محیطی برنامه اضافه کنید:
   ```env
   MYSQL_HOST=iran-mysql-host.liara.run
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_db_password
   MYSQL_DATABASE=madrasah_db
   ```
۳. سپس اسکریپت `database_complete.sql` را در دیتابیس MySQL لیارا (با phpMyAdmin یا DBeaver) ایمپورت نمایید. سامانه به‌طور هوشمند متصل شده و تمامی داده‌ها را با کلیدهای خارجی و ایندکس‌ها مدیریت می‌کند.

---

## 💾 ۴. دیسک دائمی لیara (Persistent Disks)

برای اینکه لاگ‌های سرور (`logs/`) و بکاپ‌های محلی دیتابیس در هنگام استقرار مجدد پاک نشوند:
۱. در پنل لیارا به تب **دیسک‌ها (Disks)** بروید.
۲. یک دیسک به نام `data-storage` بسازید و مسیر مانت (Mount Path) را روی `/app/logs` یا `/app/backups` قرار دهید.

---

## 🛡️ ۵. استقرار روی سرور مجازی (Ubuntu VPS) با PM2 و Nginx (روش جایگزین)

اگر قصد راه‌اندازی روی سرور لینوکس اختصاصی دارید:

```bash
# نصب Node.js 22 و ابزارها
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2

# کلون و بیلد
cd /var/www
git clone https://github.com/your-username/your-repo.git madrasah-app
cd madrasah-app
npm install
npm run build

# اجرای پروسه در بک‌گراند با مانیتورینگ
pm2 start dist/server.cjs --name "madrasah-app"
pm2 save
pm2 startup
```

کانفیگ Nginx جهت پروکسی به پورت 3000:
```nginx
server {
    listen 80;
    server_name your-domain.ir;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ✅ چک‌لیست نهایی پس از استقرار در لیارا:
- [x] تست صحت پاسخ‌دهی مسیر سلامت سرور: `https://madrasah-app.liara.run/health`
- [x] ورود با کاربر مدیر کل (`admin` و رمز `Admin@123456`)
- [x] ثبت یک رکورد آزمایشی در پرونده طلاب و بررسی ذخیره‌سازی
- [x] تست دکمه گزارش باگ در هدر و ثبت گزارش در سرور
