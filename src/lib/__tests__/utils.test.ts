import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('merges multiple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('resolves conflicting color classes', () => {
    expect(cn('text-red-500', 'text-blue-700')).toBe('text-blue-700');
  });

  it('resolves conflicting font-size classes', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined values', () => {
    expect(cn('px-2', undefined, 'py-1')).toBe('px-2 py-1');
  });

  it('handles null values', () => {
    expect(cn('px-2', null, 'py-1')).toBe('px-2 py-1');
  });

  it('handles false values', () => {
    expect(cn('px-2', false, 'py-1')).toBe('px-2 py-1');
  });

  it('handles empty string values', () => {
    expect(cn('px-2', '', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional class expressions', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles array inputs (clsx feature)', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
  });

  it('handles object inputs (clsx feature)', () => {
    expect(cn({ 'px-2': true, 'py-1': true, 'mx-4': false })).toBe('px-2 py-1');
  });

  it('merges complex conflicting classes correctly', () => {
    // bg conflict + p conflict, non-conflicting classes preserved
    expect(cn('bg-red-500 p-4 rounded', 'bg-blue-300 p-2')).toBe('rounded bg-blue-300 p-2');
  });
});
