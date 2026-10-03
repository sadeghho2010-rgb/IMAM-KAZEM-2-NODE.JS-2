# 🌐 مستندات رابط برنامه‌نویسی کاربردی (REST API Catalog)

کلیه درخواست‌ها با فرمت `application/json` ارسال و دریافت می‌شوند. در صورت نیاز به احراز هویت، هدر `Authorization: Bearer <TOKEN>` یا کوکی معتبر `auth_access_token` الزامی است.

---

## ۱. مسیرهای احراز هویت (Authentication Endpoints)

### `POST /api/auth/login`
ورود کاربر و دریافت توکن دسترسی و رفرش‌توکن.
- **Body:**
  ```json
  {
    "username": "admin",
    "password": "Admin@123456"
  }
  ```
- **Response 200:**
  ```json
  {
    "success": true,
    "user": { "id": "usr_admin", "username": "admin", "role": "super_admin", "level": 1 },
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### `GET /api/auth/me`
استعلام نشست کاربر فعلی و تایید اعتبار توکن.
- **Response 200:**
  ```json
  {
    "authenticated": true,
    "user": { ... }
  }
  ```

### `POST /api/auth/logout`
خروج از حساب کاربری و باطل‌سازی کوکی‌های نشست.

---

## ۲. مسیرهای سلامت سیستم و مانیتورینگ (Monitoring)

### `GET /health`
بررسی سلامت سرویس توسط ارکستراتورهای ابری (Runflare, Kubernetes, Docker).
- **Response 200:**
  ```json
  {
    "status": "ok",
    "uptime": 1420,
    "timestamp": "2026-10-03T09:30:00.000Z",
    "version": "1.0.1",
    "memory": {
      "rssMb": 65.2,
      "heapUsedMb": 38.1
    }
  }
  ```

---

## ۳. مسیرهای مدیریت داده‌ها (Data Proxy Endpoints)

### `GET /api/data/:collection`
دریافت اسناد یک کالکشن با اعمال فیلترهای امنیتی دسترسی براساس سطح کاربر.
- **Params:** `collection` (مانند `students`, `student_requests`, `lockers`, `tuition_records`)
- **Response 200:**
  ```json
  {
    "success": true,
    "items": [ ... ]
  }
  ```

### `POST /api/data/:collection`
ثبت یا بروزرسانی یک سند در دیتابیس با اعتبارسنجی Zod و لاگ امنیتی.
- **Body:** `{ "id": "...", ... }`

### `DELETE /api/data/:collection/:id`
حذف سند مشخص با ثبت امضای حسابرسی.

---

## ۴. مسیرهای هوش مصنوعی و تحلیل داده‌ها

### `POST /api/analyze-students`
تحلیل داده‌های دانش‌آموختگان و تولید گزارش هوشمند مشاوره‌ای از طریق Gemini API.

---

## ۵. کدهای خطای استاندارد (HTTP Status Codes)

| کد خطا | شرح |
|---|---|
| `200 OK` | عملیات با موفقیت انجام شد. |
| `400 Bad Request` | فرمت داده‌های ورودی نامعتبر است (نقض اعتبارسنجی Zod). |
| `401 Unauthorized` | کاربر وارد سامانه نشده یا توکن منقضی شده است. |
| `403 Forbidden` | کاربر مجوز دسترسی به این منبع را ندارد. |
| `429 Too Many Requests` | مسدودسازی ناشی از تلاش‌های مکرر ناموفق (Rate Limiting). |
| `500 Internal Error` | خطای پیش‌بینی‌نشده در سرور. |
