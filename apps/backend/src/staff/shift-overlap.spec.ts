import { hasOverlap } from './shift-overlap';

describe('hasOverlap', () => {
  const base = { shiftDate: '2026-08-20', startTime: '08:00', endTime: '12:00' };

  it('trả về false khi không có ca nào trùng ngày', () => {
    expect(
      hasOverlap([{ ...base, shiftDate: '2026-08-21' }], base),
    ).toBe(false);
  });

  it('trả về false khi cùng ngày nhưng không trùng giờ', () => {
    expect(
      hasOverlap([{ ...base, startTime: '13:00', endTime: '17:00' }], base),
    ).toBe(false);
  });

  it('trả về false khi hai ca chạm nhau ở biên (end = start)', () => {
    expect(
      hasOverlap([{ ...base, startTime: '12:00', endTime: '16:00' }], base),
    ).toBe(false);
  });

  it('trả về true khi trùng một phần', () => {
    expect(
      hasOverlap([{ ...base, startTime: '10:00', endTime: '14:00' }], base),
    ).toBe(true);
  });

  it('trả về true khi ca mới nằm trọn trong ca cũ', () => {
    expect(
      hasOverlap([{ ...base, startTime: '07:00', endTime: '13:00' }], base),
    ).toBe(true);
  });

  it('trả về true khi trùng hoàn toàn', () => {
    expect(hasOverlap([{ ...base }], base)).toBe(true);
  });
});
