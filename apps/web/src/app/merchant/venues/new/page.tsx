import { VenueForm } from './venue-form';

export default function NewVenuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Tạo cụm sân mới</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sau khi tạo, bạn sẽ được chuyển tới trang quản lý sân con của cụm sân này.
        </p>
      </div>
      <VenueForm />
    </div>
  );
}
