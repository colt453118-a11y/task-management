import { describe, it, expect } from 'vitest';
import { createSlug, isValidSlug } from '../utils/slug';

// ─── createSlug ──────────────────────────────────────────────

describe('createSlug', () => {
  it('should convert basic text to lowercase slug', () => {
    expect(createSlug('Project Manager')).toBe('project-manager');
  });

  it('should replace multiple spaces with single hyphen', () => {
    expect(createSlug('Hello   World')).toBe('hello-world');
  });

  it('should strip leading and trailing whitespace', () => {
    expect(createSlug('  Hello World  ')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(createSlug('Task #123 @home!')).toBe('task-123-home');
  });

  it('should preserve existing hyphens', () => {
    expect(createSlug('already-a-slug')).toBe('already-a-slug');
  });

  it('should preserve underscores', () => {
    expect(createSlug('snake_case_value')).toBe('snake_case_value');
  });

  it('should strip leading and trailing hyphens', () => {
    expect(createSlug('--hello-world---')).toBe('hello-world');
  });

  it('should handle single word', () => {
    expect(createSlug('Hello')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(createSlug('')).toBe('');
  });

  it('should handle numbers', () => {
    expect(createSlug('Version 2.0')).toBe('version-20');
  });
});

// ─── isValidSlug ─────────────────────────────────────────────

describe('isValidSlug', () => {
  it('should return true for a valid lowercase slug', () => {
    expect(isValidSlug('project-manager')).toBe(true);
  });

  it('should return true for a slug with underscores', () => {
    expect(isValidSlug('snake_case')).toBe(true);
  });

  it('should return true for a slug with numbers', () => {
    expect(isValidSlug('task123')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('should return false for slugs starting with hyphen', () => {
    expect(isValidSlug('-project')).toBe(false);
  });

  it('should return false for uppercase letters', () => {
    expect(isValidSlug('Project')).toBe(false);
  });

  it('should return false for spaces', () => {
    expect(isValidSlug('project manager')).toBe(false);
  });

  it('should return false for special characters', () => {
    expect(isValidSlug('task#123')).toBe(false);
  });

  it('should return true for a slug starting with digit', () => {
    expect(isValidSlug('123task')).toBe(true);
  });
});
