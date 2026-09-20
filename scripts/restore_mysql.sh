#!/bin/bash
# ==============================================================================
# اسکریپت بازیابی نسخه پشتیبان MySQL
# نحوه اجرا: ./restore_mysql.sh /var/backups/mysql/madrasah/backup_madrasah_db_xxxx.sql.gz
# ==============================================================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "خطا: لطفاً مسیر معتبر فایل بکاپ را وارد کنید."
  echo "مثال: $0 /var/backups/mysql/madrasah/backup_madrasah_db_20260920.sql.gz"
  exit 1
fi

DB_USER=${DB_USER:-"madrasah_app"}
DB_PASS=${DB_PASS:-"StrongSecretPasswordHere"}
DB_NAME=${DB_NAME:-"madrasah_db"}
DB_HOST=${DB_HOST:-"127.0.0.1"}

echo "⚠️ اخطار: اطلاعات دیتابیس فعلی با داده‌های بکاپ بازنویسی خواهد شد."
echo "شروع بازیابی از فایل: ${BACKUP_FILE} ..."

# اکسترکت و ایمپورت در دیتابیس
gunzip -c "$BACKUP_FILE" | mysql --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" "$DB_NAME"

echo "✅ بازیابی دیتابیس با موفقیت به پایان رسید."
