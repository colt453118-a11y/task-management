import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSlackNotification, testSlackWebhook } from '@/lib/slack/webhook';

// ─── Mocks ──────────────────────────────────────────────────

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock database chain helpers
const createMockChain = (finalResult: unknown) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(finalResult),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
};

let mockChain = createMockChain([undefined]);

const mockDb = {
  select: (...args: unknown[]) => {
    mockChain.select(...args);
    return mockChain;
  },
  update: (...args: unknown[]) => {
    mockChain.update(...args);
    return mockChain;
  },
};

// Mock getDb to return our mock database
vi.mock('@workmanagement/database', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    slackIntegrations: {
      id: 'id',
      organizationId: 'organization_id',
      webhookUrl: 'webhook_url',
      isActive: 'is_active',
      lastUsedAt: 'last_used_at',
      lastError: 'last_error',
      updatedAt: 'updated_at',
    },
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: string, value: unknown) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions, type: 'and' })),
}));

// ─── Test Suite ─────────────────────────────────────────────

describe('Slack Webhook Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createMockChain([undefined]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendSlackNotification', () => {
    it('should not send if no active integration exists', async () => {
      // Mock no integration found
      mockChain = createMockChain([undefined]);

      await sendSlackNotification('org-123', { text: 'Hello' });

      // Should not call fetch
      expect(mockFetch).not.toHaveBeenCalled();
      // Should have queried for integration
      expect(mockChain.select).toHaveBeenCalled();
      expect(mockChain.from).toHaveBeenCalled();
      expect(mockChain.where).toHaveBeenCalled();
      expect(mockChain.limit).toHaveBeenCalledWith(1);
    });

    it('should send message to webhook when integration exists', async () => {
      const integration = {
        id: 'int-1',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        organizationId: 'org-123',
      };

      // Mock integration found
      mockChain = createMockChain([integration]);
      
      // Mock successful fetch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await sendSlackNotification('org-123', { text: 'Test message' });

      // Should call fetch with correct parameters (plus the SSRF-hardening
      // options — signal/redirect/dispatcher — which objectContaining ignores).
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/xxx',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Test message',
            blocks: undefined,
          }),
        }),
      );

      // Should update integration with lastUsedAt
      expect(mockChain.update).toHaveBeenCalled();
      expect(mockChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedAt: expect.any(Date),
          lastError: null,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should include blocks when provided', async () => {
      const integration = {
        id: 'int-1',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        organizationId: 'org-123',
      };

      mockChain = createMockChain([integration]);
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: 'Hello' } },
      ];

      await sendSlackNotification('org-123', { text: 'Hello', blocks });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/xxx',
        expect.objectContaining({
          body: JSON.stringify({
            text: 'Hello',
            blocks,
          }),
        }),
      );
    });

    it('should record error when webhook fails', async () => {
      const integration = {
        id: 'int-1',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        organizationId: 'org-123',
      };

      mockChain = createMockChain([integration]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await sendSlackNotification('org-123', { text: 'Test' });

      // Should record the error
      expect(mockChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastError: 'HTTP 400',
        }),
      );
    });

    it('should handle fetch network errors gracefully', async () => {
      const integration = {
        id: 'int-1',
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        organizationId: 'org-123',
      };

      mockChain = createMockChain([integration]);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await sendSlackNotification('org-123', { text: 'Test' });

      // Should record the error
      expect(mockChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastError: 'Network error',
        }),
      );
    });

    it('should not throw on database errors', async () => {
      mockChain = createMockChain([undefined]);
      mockChain.select.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw
      await expect(
        sendSlackNotification('org-123', { text: 'Test' }),
      ).resolves.toBeUndefined();
    });

    it('blocks an integration whose webhook URL is private/reserved (SSRF guard)', async () => {
      const integration = {
        id: 'int-1',
        webhookUrl: 'http://169.254.169.254/latest/meta-data/', // cloud metadata
        organizationId: 'org-123',
      };
      mockChain = createMockChain([integration]);

      await sendSlackNotification('org-123', { text: 'Test' });

      // Never reaches the network, and the block reason is recorded.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastError: expect.stringMatching(/^Blocked:/) }),
      );
    });
  });

  describe('testSlackWebhook', () => {
    it('should send test message to webhook URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/xxx',
      );

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/xxx',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '✅ WorkManager test notification - connection successful!',
          }),
        }),
      );
    });

    it('should return error when webhook URL is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/invalid',
      );

      expect(result).toEqual({
        success: false,
        error: 'HTTP 404',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/xxx',
      );

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/xxx',
      );

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await testSlackWebhook(
        'https://hooks.slack.com/services/T00/B00/xxx',
      );

      expect(result).toEqual({
        success: false,
        error: 'Request timeout',
      });
    });

    it('blocks a private/metadata URL without making a request (SSRF guard)', async () => {
      const result = await testSlackWebhook('http://169.254.169.254/latest/meta-data/');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Blocked:/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('blocks a non-http(s) protocol without making a request (SSRF guard)', async () => {
      const result = await testSlackWebhook('file:///etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Blocked:/);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
