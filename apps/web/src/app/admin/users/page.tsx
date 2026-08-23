import { Role } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
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
        <p className="text-sm text-muted-foreground">Không tìm thấy người dùng phù hợp.</p>
      )}

      <div className="flex flex-col gap-3">
        {userList.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex items-center justify-between gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <p className="font-medium">{user.fullName}</p>
                <p className="text-muted-foreground">
                  {user.email} — {user.role}
                </p>
                <StatusBadge variant={user.isLocked ? 'neutral' : 'success'}>
                  {user.isLocked ? 'Đã khóa' : 'Đang hoạt động'}
                </StatusBadge>
              </div>
              <form action={(user.isLocked ? unlockUser : lockUser).bind(null, user.id)}>
                <Button type="submit" variant={user.isLocked ? 'outline' : 'destructive'}>
                  {user.isLocked ? 'Mở khóa' : 'Khóa'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={usersPage.meta.page} totalPages={usersPage.meta.totalPages} />
    </div>
  );
}
