import { describe, expect, it } from 'vitest';
import { withParam } from './list-query';

describe('withParam', () => {
  it('sets a new param and resets page', () => {
    const current = new URLSearchParams('page=3&status=OPEN');
    const params = new URLSearchParams(withParam(current, { q: 'nguyen' }));
    expect(params.get('q')).toBe('nguyen');
    expect(params.get('status')).toBe('OPEN');
    expect(params.has('page')).toBe(false);
  });

  it('removes a param when set to an empty string', () => {
    const current = new URLSearchParams('q=abc');
    expect(new URLSearchParams(withParam(current, { q: '' })).has('q')).toBe(false);
  });

  it('keeps an explicit page value when updating page directly', () => {
    const current = new URLSearchParams('q=abc&page=1');
    const params = new URLSearchParams(withParam(current, { page: '2' }));
    expect(params.get('page')).toBe('2');
    expect(params.get('q')).toBe('abc');
  });
});
