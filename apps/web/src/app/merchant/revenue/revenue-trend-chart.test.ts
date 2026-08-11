import { describe, expect, it } from 'vitest';
import { formatBucketFull, formatBucketShort } from './revenue-trend-chart';

describe('formatBucketShort', () => {
  it('định dạng bucket ngày (week/month) thành dd/MM', () => {
    expect(formatBucketShort('2026-03-05', false)).toBe('05/03');
    expect(formatBucketShort('2026-11-30', false)).toBe('30/11');
  });

  it('định dạng bucket tháng (year) thành "Thg M/yy"', () => {
    expect(formatBucketShort('2026-03', true)).toBe('Thg 3/26');
    expect(formatBucketShort('2026-11', true)).toBe('Thg 11/26');
  });
});

describe('formatBucketFull', () => {
  it('định dạng bucket ngày thành dd/MM/yyyy', () => {
    expect(formatBucketFull('2026-03-05', false)).toBe('05/03/2026');
  });

  it('định dạng bucket tháng thành "Tháng M/yyyy"', () => {
    expect(formatBucketFull('2026-03', true)).toBe('Tháng 3/2026');
  });
});
