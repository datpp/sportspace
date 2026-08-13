'use client';

export default function AdminConfigError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-red-600 dark:text-red-400">
        Có lỗi xảy ra khi tải hoặc lưu cấu hình hệ thống.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        Thử lại
      </button>
    </div>
  );
}
