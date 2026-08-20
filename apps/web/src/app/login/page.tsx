import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Đăng nhập SportSpace</h1>
      <LoginForm />
      <Link href="/forgot-password" className="text-sm hover:underline">
        Quên mật khẩu?
      </Link>
    </div>
  );
}
