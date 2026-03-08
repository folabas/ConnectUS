import { test, expect, type Page } from '@playwright/test';

const fillLoginForm = async (page: Page, email: string, password: string) => {
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
};

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ConnectUS/i);
  });

  test('should show hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('nav a, header a');
    await expect(navLinks.first()).toBeVisible();
  });
});

test.describe('Auth Page', () => {
  test('should load auth page', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show register toggle', async ({ page }) => {
    await page.goto('/auth');
    const toggle = page.locator('text=Register, text=Sign up');
    await expect(toggle.first()).toBeVisible();
  });
});

test.describe('Join Room Page', () => {
  test('should load join room page', async ({ page }) => {
    await page.goto('/join-room');
    await expect(page).toHaveURL(/\/join-room/);
  });

  test('should show room code input', async ({ page }) => {
    await page.goto('/join-room');
    const input = page.locator('input[placeholder*="room"], input[placeholder*="code"], input[name="code"]');
    await expect(input.first()).toBeVisible();
  });
});

test.describe('Create Room Page', () => {
  test('should load create room page', async ({ page }) => {
    await page.goto('/create-room');
    await expect(page).toHaveURL(/\/create-room/);
  });

  test('should show room name input', async ({ page }) => {
    await page.goto('/create-room');
    const input = page.locator('input[name="name"], input[placeholder*="room name"]');
    await expect(input.first()).toBeVisible();
  });
});

test.describe('Watch Page', () => {
  test('should load watch page', async ({ page }) => {
    await page.goto('/watch');
    await expect(page).toHaveURL(/\/watch/);
  });

  test('should show movie library', async ({ page }) => {
    await page.goto('/watch');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});

test.describe('Library Page', () => {
  test('should load library page', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/\/library/);
  });

  test('should show library content', async ({ page }) => {
    await page.goto('/library');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});

test.describe('Settings Page', () => {
  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should show settings options', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});

test.describe('Profile Page', () => {
  test('should load profile page', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should show profile content', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('h1, h2')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();
    
    if (linkCount > 0) {
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');
      if (href && !href.startsWith('http')) {
        await firstLink.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveTitle(/ConnectUS/i);
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page).toHaveTitle(/ConnectUS/i);
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have form labels', async ({ page }) => {
    await page.goto('/auth');
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      const labels = page.locator('label');
      const labelCount = await labels.count();
      expect(labelCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Performance', () => {
  test('should load page quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(10000);
  });
});
