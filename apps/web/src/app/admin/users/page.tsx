import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { lockUser, unlockUser } from './actions';

export default async function AdminUsersPage() {
  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  let allUsers;
  try {
    const { data } = await users.userControllerFindAll();
    allUsers = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Người dùng</h1>

      <div className="flex flex-col gap-3">
        {allUsers.map((user) => (
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
    </div>
  );
}
