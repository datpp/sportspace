import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-extrabold text-foreground">Quên mật khẩu</h1>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm text-primary hover:underline">
        Quay lại đăng nhập
      </Link>
    </div>
  );
}
