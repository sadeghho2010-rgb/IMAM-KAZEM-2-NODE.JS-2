-- ==============================================================================
-- Schema Definition for Application & Security Logging (Supabase / PostgreSQL)
-- ==============================================================================

-- 1. جدول لاگ‌های خطای نرم‌افزار و تریس‌ها (app_logs)
CREATE TABLE IF NOT EXISTS public.app_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trace_id VARCHAR(36) NOT NULL,
  user_id BIGINT NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack_trace TEXT NULL,
  context JSONB NULL,
  path VARCHAR(255) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ایندکس‌های بهینه‌سازی جستجو و مرتب‌سازی لاگ‌ها
CREATE INDEX IF NOT EXISTS idx_app_logs_trace ON public.app_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON public.app_logs (created_at DESC);

-- ۲. جدول لاگ‌های ممیزی عملیات (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id BIGINT NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  before JSONB NULL,
  after JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۳. فعال‌سازی RLS و سیاست‌های دسترسی
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_and_auth_insert_app_logs" ON public.app_logs 
FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "anon_and_auth_select_app_logs" ON public.app_logs 
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_and_auth_all_audit_logs" ON public.audit_logs 
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
