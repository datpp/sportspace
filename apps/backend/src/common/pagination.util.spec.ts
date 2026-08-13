import { buildPaginationMeta } from './pagination.util';

describe('buildPaginationMeta', () => {
  it('rounds totalPages up from total/limit', () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns totalPages=1 when there are zero results, never zero', () => {
    expect(buildPaginationMeta(0, 1, 20)).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });
});
