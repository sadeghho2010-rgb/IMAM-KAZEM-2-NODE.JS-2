-- ==============================================================================
-- اسکریپت پایگاه داده: مدیریت مستقل نمایش منو (Visibility) و مجوز ویرایش (Editability)
-- Database Script: Independent Menu Visibility and Editability Control
-- ==============================================================================

-- ۱. اطمینان از وجود ستون‌های مورد نیاز در جدول کاربران (system_users)
ALTER TABLE IF EXISTS public.system_users 
ADD COLUMN IF NOT EXISTS editable_tabs JSONB DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.system_users 
ADD COLUMN IF NOT EXISTS module_permissions JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.system_users 
ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.system_users 
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT TRUE;

-- ۲. ساخت ایندکس‌های بهینه‌سازی
CREATE INDEX IF NOT EXISTS idx_system_users_role ON public.system_users (role);
CREATE INDEX IF NOT EXISTS idx_system_users_level ON public.system_users (level);
CREATE INDEX IF NOT EXISTS idx_system_users_username ON public.system_users (username);

-- ۳. به‌روزرسانی ساختار JSON در جدول app_collections برای سازگاری کامل
-- ستون data در جدول app_collections حاوی فیلدهای زیر برای هر کاربر است:
-- {
--   "allowedTabs": ["academic-calendar", "students", ...],
--   "editableTabs": ["students", ...],
--   "modulePermissions": {
--     "academic-calendar": "view",
--     "students": "edit",
--     "finance": "none"
--   },
--   "isReadOnly": false,
--   "canEdit": true
-- }

-- ۴. تضمین دسترسی سوپر ادمین (SADEGH) به تمام بخش‌ها با مجوز ویرایش
UPDATE public.system_users
SET 
  level = 1,
  role = 'super_admin',
  is_read_only = FALSE,
  can_edit = TRUE,
  updated_at = NOW()
WHERE UPPER(username) = 'SADEGH';

-- ۵. توضیح حالات دسترسی (Documentation):
-- هر بخش سیستمی (Module/Tab) می‌تواند یکی از ۳ مقدار زیر را در module_permissions داشته باشد:
-- ۱. "none": کاملاً مخفی از منو و عدم امکان دسترسی مستقیم (Visibility = false, Editability = false)
-- ۲. "view": نمایش در منو با مجوز فقط مشاهده (Visibility = true, Editability = false)
-- ۳. "edit": نمایش در منو با مجوز کامل ایجاد، ویرایش و حذف (Visibility = true, Editability = true)
