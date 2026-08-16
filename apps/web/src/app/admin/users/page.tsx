import { Role } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { lockUser, unlockUser } from './actions';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const role = typeof sp.role === 'string' ? (sp.role as Role) : undefined;
  const isLocked = typeof sp.isLocked === 'string' ? sp.isLocked : undefined;

  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  let usersPage;
  try {
    const { data } = await users.userControllerFindAll({ page, q, role, isLocked });
    usersPage = data;
  } catch (err) {
    handleApiError(err);
  }

  const userList = usersPage.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Người dùng</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc email" />
        <FilterSelect
          paramKey="role"
          label="Vai trò"
          options={[
            { value: '', label: 'Tất cả' },
            { value: Role.PLAYER, label: 'Người chơi' },
            { value: Role.MERCHANT, label: 'Chủ sân' },
            { value: Role.ADMIN, label: 'Quản trị' },
          ]}
        />
        <FilterSelect
          paramKey="isLocked"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'false', label: 'Đang hoạt động' },
            { value: 'true', label: 'Đã khóa' },
          ]}
        />
      </div>

      {userList.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không tìm thấy người dùng phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {userList.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{user.fullName}</p>
              <p className="text-zinc-500">
                {user.email} — {user.role}
              </p>
              {user.isLocked && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">Đã khóa</p>
              )}
            </div>
            <form action={(user.isLocked ? unlockUser : lockUser).bind(null, user.id)}>
              <button
                type="submit"
                className={
                  user.isLocked
                    ? 'rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : 'rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400'
                }
              >
                {user.isLocked ? 'Mở khóa' : 'Khóa'}
              </button>
            </form>
          </div>
        ))}
      </div>

      <Pagination page={usersPage.meta.page} totalPages={usersPage.meta.totalPages} />
    </div>
  );
}
