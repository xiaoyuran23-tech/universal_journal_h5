// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Settings Page & Save Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Wait for app to fully initialize
    await page.waitForTimeout(2000);
  });

  test('1. Settings page should be visible and clickable', async ({ page }) => {
    // Click the "我" tab
    await page.click('.tab-item[data-page="profile"]');
    await page.waitForTimeout(500);

    // Profile page should be visible
    const profilePage = page.locator('#page-profile');
    await expect(profilePage).toBeVisible();

    // Settings items should be visible
    const settingsItems = page.locator('.settings-container .settings-item');
    const count = await settingsItems.count();
    expect(count).toBeGreaterThanOrEqual(7); // 导出, 导入, 清空, 回收站, 模板, 云同步, + 密码锁, 主题, 统计, 关于
  });

  test('2. Save a new record via FAB button', async ({ page }) => {
    // Click FAB to create a record
    await page.click('#fab-add');
    await page.waitForTimeout(500);

    // Form page should be visible
    const formPage = page.locator('#page-form');
    await expect(formPage).toBeVisible();

    // Fill in the form
    const nameInput = page.locator('#create-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Playwright Test Record');

    // Find and click the submit/save button
    const submitBtn = page.locator('#submit-btn');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    } else {
      // Try alternative selectors
      const saveBtn = page.locator('button[type="submit"], .form-save-btn, .submit-btn');
      if (await saveBtn.count() > 0) {
        await saveBtn.first().click();
      }
    }

    await page.waitForTimeout(1000);

    // Should be back on home page
    const homePage = page.locator('#page-home');
    await expect(homePage).toBeVisible();
  });

  test('3. Navigate between tabs works correctly', async ({ page }) => {
    const tabs = ['home', 'calendar', 'timeline', 'favorites', 'profile'];
    for (const tab of tabs) {
      await page.click(`.tab-item[data-page="${tab}"]`);
      await page.waitForTimeout(300);
      const pageEl = page.locator(`#page-${tab === 'home' ? 'home' : tab}`);
      await expect(pageEl).toBeVisible();
    }
  });
});
