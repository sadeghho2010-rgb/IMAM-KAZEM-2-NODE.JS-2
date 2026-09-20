#!/bin/bash
# ==============================================================================
# اسکریپت پشتیبان‌گیری خودکار دیتابیس MySQL با قابلیت فشرده‌سازی و مدیریت چرخه نگهداری
# ==============================================================================

set -e

# متغیرهای اتصال به دیتابیس
DB_USER=${DB_USER:-"madrasah_app"}
DB_PASS=${DB_PASS:-"StrongSecretPasswordHere"}
DB_NAME=${DB_NAME:-"madrasah_db"}
DB_HOST=${DB_HOST:-"127.0.0.1"}

# مسیرهای محلی نگهداری فایل‌های بکاپ
BACKUP_DIR="/var/backups/mysql/madrasah"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${DATE_TAG}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting MySQL backup for ${DB_NAME}..."

# تهیه دامپ و فشرده‌سازی همزمان با gzip
mysqldump --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" \
  --single-transaction --quick --routines --triggers "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup completed: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# ==============================================================================
# سیاست پاک‌سازی و حفظ نسخه‌ها (Retention Policy)
# - ۷ نسخه روزانه
# - ۴ نسخه هفتگی (بکاپ‌های بیش از ۷ روز پاک می‌شوند)
# ==============================================================================
echo "[$(date)] Applying retention policy..."
find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +7 -exec rm {} \;

echo "[$(date)] Backup process finished successfully."
