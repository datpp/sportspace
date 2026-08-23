import type { SystemConfig } from '@sportspace/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Field key + nhãn — actions.ts đọc đúng các key này qua formData.get(key), không đổi.
const FIELDS: { name: keyof Omit<SystemConfig, 'id' | 'updatedAt'>; label: string }[] = [
  { name: 'cancellationFullRefundHours', label: 'Hoàn 100% nếu hủy trước (giờ)' },
  { name: 'cancellationPartialRefundHours', label: 'Hoàn một phần nếu hủy trước (giờ)' },
  { name: 'cancellationPartialRefundPercent', label: 'Tỷ lệ hoàn một phần (%)' },
  { name: 'platformCommissionPercent', label: 'Hoa hồng nền tảng (%)' },
];

export function SystemConfigForm({
  config,
  action,
}: {
  config: SystemConfig;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {FIELDS.map(({ name, label }) => (
        <div className="flex flex-col gap-1.5" key={name}>
          <Label htmlFor={name}>{label}</Label>
          <Input type="number" id={name} name={name} defaultValue={config[name]} min={0} />
        </div>
      ))}
      <Button type="submit" className="self-start">
        Lưu
      </Button>
    </form>
  );
}
