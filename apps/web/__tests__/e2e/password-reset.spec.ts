import { test, expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Mock the forgot-password API to return a success response.
 * Call this before navigating to /auth/forgot-password.
 */
async function mockForgotPasswordSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/request-password-reset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

/**
 * Mock the reset-password API to return a success response.
 */
async function mockResetPasswordSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/reset-password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

// ─── Forgot Password ───────────────────────────────────────────

test.describe('forgot-password page', () => {
  test('renders the forgot-password form', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('shows success screen after submitting email', async ({ page }) => {
    await mockForgotPasswordSuccess(page);
    await page.goto('/auth/forgot-password');

    await page.getByLabel(/email/i).fill('user@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/reset link/i)).toBeVisible();
  });

  test('shows error when email submission fails', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    // Set up route AFTER navigation to ensure it intercepts
    await page.route('**/api/auth/request-password-reset', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email not found' }),
      });
    });

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/email not found/i)).toBeVisible({ timeout: 10_000 });
  });

  test('provides a link back to login', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/auth/login');
  });

  test('is a public route (not redirected by proxy)', async ({ request }) => {
    const response = await request.get('/auth/forgot-password', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });
});

// ─── Reset Password ────────────────────────────────────────────

test.describe('reset-password page', () => {
  test('shows invalid link message when no token is provided', async ({ page }) => {
    await page.goto('/auth/reset-password');

    // Wait for the page to hydrate: the heading should appear
    await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/reset link is invalid/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
  });

  test('shows error banner when INVALID_TOKEN error param is present', async ({ page }) => {
    await page.goto('/auth/reset-password?token=abc&error=INVALID_TOKEN');

    await expect(page.getByRole('alert')).toContainText(/invalid or expired reset link/i, { timeout: 15_000 });
  });

  test('renders password form when a token is provided', async ({ page }) => {
    await page.goto('/auth/reset-password?token=valid-reset-token-123');

    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/^new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
  });

  test('shows validation error when password is too short', async ({ page }) => {
    await page.goto('/auth/reset-password?token=valid-reset-token');

    // Wait for the form to hydrate
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });

    // Remove the minLength attribute so browser validation doesn't block submit,
    // then click the button normally to test React's in-component validation.
    await page.evaluate(() => {
      const pw = document.getElementById('password');
      if (pw) pw.removeAttribute('minLength');
    });
    await page.getByLabel(/^new password/i).fill('1234567'); // 7 chars, min is 8
    await page.getByLabel(/confirm password/i).fill('1234567');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows validation error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/reset-password?token=valid-reset-token');

    // Wait for the form to hydrate
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/^new password/i).fill('ValidPassword123');
    await page.getByLabel(/confirm password/i).fill('DifferentPassword456');
    // Use JS submit to bypass browser constraint validation
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });

    await expect(page.getByText(/do not match/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows success screen after successful password reset', async ({ page }) => {
    await mockResetPasswordSuccess(page);
    await page.goto('/auth/reset-password?token=valid-reset-token');

    // Wait for the form to hydrate
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/^new password/i).fill('NewValidP@ss1');
    await page.getByLabel(/confirm password/i).fill('NewValidP@ss1');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByRole('heading', { name: /password reset/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/password has been reset/i)).toBeVisible();
  });

  test('handles API error during password reset', async ({ page }) => {
    await page.goto('/auth/reset-password?token=expired-token');

    // Wait for the form to hydrate
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });

    // Set up route AFTER navigation
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired token' }),
      });
    });

    await page.getByLabel(/^new password/i).fill('NewValidP@ss1');
    await page.getByLabel(/confirm password/i).fill('NewValidP@ss1');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/invalid or expired token/i)).toBeVisible({ timeout: 10_000 });
  });

  test('provides a link to sign in after success', async ({ page }) => {
    await mockResetPasswordSuccess(page);
    await page.goto('/auth/reset-password?token=valid-reset-token');

    // Wait for the form to hydrate
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/^new password/i).fill('NewValidP@ss1');
    await page.getByLabel(/confirm password/i).fill('NewValidP@ss1');
    await page.getByRole('button', { name: /reset password/i }).click();

    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/auth/login');
  });

  test('is a public route (not redirected by proxy)', async ({ request }) => {
    const response = await request.get('/auth/reset-password', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });
});
