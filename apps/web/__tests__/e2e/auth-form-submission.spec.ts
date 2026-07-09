import { test, expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Mock the sign-in API (better-auth) to return a success response
 * and set the session cookie that proxy.ts checks.
 */
async function mockSignInSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/sign-in/email', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'set-cookie': 'better-auth.session_token=mock-session-token; Path=/; HttpOnly; SameSite=Lax',
      },
      body: JSON.stringify({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        session: { id: 'session-1', token: 'mock-token' },
      }),
    });
  });
}

/**
 * Mock the sign-up API (better-auth) to return a success response
 * and set the session cookie that proxy.ts checks.
 */
async function mockSignUpSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/sign-up/email', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'set-cookie': 'better-auth.session_token=mock-session-token; Path=/; HttpOnly; SameSite=Lax',
      },
      body: JSON.stringify({
        user: { id: 'user-2', email: 'new@example.com', name: 'New User' },
        session: { id: 'session-2', token: 'mock-token' },
      }),
    });
  });
}

// ─── Login ──────────────────────────────────────────────────────

test.describe('login page', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error message when credentials are invalid', async ({ page }) => {
    await page.goto('/auth/login');

    // Mock the sign-in API to return an error after navigation
    await page.route('**/api/auth/sign-in/email', async (route) => {
      // Better-auth returns errors as { error: 'message string' }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid email or password' }),
      });
    });

    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    await page.goto('/auth/login');

    // Mock the sign-in API to return success after navigation
    await mockSignInSuccess(page);

    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('correctpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // After successful login, the page should navigate to /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('provides a link to forgot-password', async ({ page }) => {
    await page.goto('/auth/login');

    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password');
  });

  test('provides a link to sign up', async ({ page }) => {
    await page.goto('/auth/login');

    const signUpLink = page.getByRole('link', { name: /sign up/i });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/auth/register');
  });

  test('shows disabled social login buttons', async ({ page }) => {
    await page.goto('/auth/login');

    const googleButton = page.getByRole('button', { name: /google/i });
    const microsoftButton = page.getByRole('button', { name: /microsoft/i });

    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeDisabled();
    await expect(microsoftButton).toBeVisible();
    await expect(microsoftButton).toBeDisabled();
  });

  test('is a public route (not redirected by proxy)', async ({ request }) => {
    const response = await request.get('/auth/login', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });
});

// ─── Register ───────────────────────────────────────────────────

test.describe('register page', () => {
  test('renders the registration form', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('shows validation error when password is too short', async ({ page }) => {
    await page.goto('/auth/register');

    // Remove minLength so browser validation doesn't block submit
    await page.evaluate(() => {
      const pw = document.getElementById('password');
      if (pw) pw.removeAttribute('minLength');
    });

    await page.getByLabel(/first name/i).fill('Jane');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email/i).fill('jane@example.com');
    await page.getByLabel(/password/i).fill('Abc123'); // 7 chars, min is 8
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows error when registration fails', async ({ page }) => {
    await page.goto('/auth/register');

    await page.route('**/api/auth/sign-up/email', async (route) => {
      // Better-auth client normalizes the error; the fallback message is used
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Email already registered' } }),
      });
    });

    // Remove minLength so browser validation doesn't block submit
    await page.evaluate(() => {
      const pw = document.getElementById('password');
      if (pw) pw.removeAttribute('minLength');
    });

    await page.getByLabel(/first name/i).fill('Jane');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email/i).fill('existing@example.com');
    await page.getByLabel(/password/i).fill('SecurePass123');
    await page.getByRole('button', { name: /create account/i }).click();

    // better-auth client doesn't forward nested error.message, uses fallback
    await expect(page.getByText(/registration failed/i)).toBeVisible({ timeout: 10_000 });
  });

  test('redirects to dashboard on successful registration', async ({ page }) => {
    await page.goto('/auth/register');

    await mockSignUpSuccess(page);

    // Remove minLength so browser validation doesn't block submit
    await page.evaluate(() => {
      const pw = document.getElementById('password');
      if (pw) pw.removeAttribute('minLength');
    });

    await page.getByLabel(/first name/i).fill('Jane');
    await page.getByLabel(/last name/i).fill('Doe');
    await page.getByLabel(/email/i).fill('new@example.com');
    await page.getByLabel(/password/i).fill('SecurePass123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('provides a link to sign in', async ({ page }) => {
    await page.goto('/auth/register');

    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/auth/login');
  });

  test('is a public route (not redirected by proxy)', async ({ request }) => {
    const response = await request.get('/auth/register', {
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(307);
  });
});
