import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUsers } from '@/lib/admin/data';

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">ユーザー一覧</h2>
        <Badge variant="secondary">{users.length} ユーザー</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">名前</th>
                  <th className="pb-2 pr-4 font-medium">メール</th>
                  <th className="pb-2 pr-4 font-medium">所属法人</th>
                  <th className="pb-2 pr-4 font-medium">ロール</th>
                  <th className="pb-2 font-medium">最終ログイン</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{user.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-2.5 pr-4">{user.organizationName}</td>
                    <td className="py-2.5 pr-4">
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role === 'admin' ? '管理者' : 'メンバー'}
                      </Badge>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString(
                            'ja-JP',
                          )
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
