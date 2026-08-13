export interface ShiftRange {
  shiftDate: string;
  startTime: string;
  endTime: string;
}

export function hasOverlap(existing: ShiftRange[], candidate: ShiftRange): boolean {
  return existing.some(
    (shift) =>
      shift.shiftDate === candidate.shiftDate &&
      shift.startTime < candidate.endTime &&
      candidate.startTime < shift.endTime,
  );
}
