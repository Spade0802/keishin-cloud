import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getOrganizations } from '@/lib/admin/data';

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">法人一覧</h2>
        <Badge variant="secondary">{organizations.length} 法人</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">法人名</th>
                  <th className="pb-2 pr-4 font-medium">許可番号</th>
                  <th className="pb-2 pr-4 font-medium">登録日</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    ユーザー数
                  </th>
                  <th className="pb-2 font-medium text-right">試算回数</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                      {org.permitNumber}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {new Date(org.registeredAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono">
                      {org.userCount}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {org.simulationCount}
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
