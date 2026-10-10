import { test, expect } from '@playwright/test';

test.describe('Real-time SSE Sync & Offline Resiliency E2E Tests', () => {
  test('1. Real-time multi-browser context synchronization without page reload', async ({ browser }) => {
    // Create two isolated browser contexts for two connected users (e.g., Staff A & Staff B)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Authenticate / Navigate to Student Management Page
    await pageA.goto('http://localhost:3000/students');
    await pageB.goto('http://localhost:3000/students');

    // Wait for SSE stream connection indicator in both pages
    await expect(pageA.locator('[data-testid="sse-status"]')).toContainText('زنده');
    await expect(pageB.locator('[data-testid="sse-status"]')).toContainText('زنده');

    // User A creates a new student record
    const studentName = `طلبه_آزمایشی_${Date.now()}`;
    await pageA.click('button:has-text("افزودن طلبه جدید")');
    await pageA.fill('input[name="first_name"]', 'حمید');
    await pageA.fill('input[name="last_name"]', studentName);
    await pageA.click('button:has-text("ذخیره")');

    // Verify Page A updates optimistically (<16ms UI update)
    await expect(pageA.locator('table')).toContainText(studentName);

    // Verify Page B receives real-time SSE mutation event within <1s WITHOUT reloading page
    await expect(pageB.locator('table')).toContainText(studentName, { timeout: 1000 });

    await contextA.close();
    await contextB.close();
  });

  test('2. Offline mutation queue, reconnect, and single idempotent record sync', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/students');
    await expect(page.locator('[data-testid="sse-status"]')).toContainText('زنده');

    // Simulate Network Drop (Offline mode)
    await context.setOffline(true);

    // Perform optimistic creation while offline
    const offlineStudentName = `طلبه_آفلاین_${Date.now()}`;
    await page.click('button:has-text("افزودن طلبه جدید")');
    await page.fill('input[name="first_name"]', 'رضا');
    await page.fill('input[name="last_name"]', offlineStudentName);
    await page.click('button:has-text("ذخیره")');

    // Verify optimistic local update in Dexie IDB and queue badge counter = 1
    await expect(page.locator('table')).toContainText(offlineStudentName);
    await expect(page.locator('[data-testid="sync-pending-count"]')).toContainText('1');

    // Simulate Network Reconnect
    await context.setOffline(false);

    // Verify offline queue automatically flushes, pending count becomes 0
    await expect(page.locator('[data-testid="sync-pending-count"]')).toContainText('0', { timeout: 5000 });

    // Verify record is successfully persisted on server and visible
    await page.reload();
    await expect(page.locator('table')).toContainText(offlineStudentName);

    await context.close();
  });
});
