import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSimulations } from '@/lib/admin/data';

export default async function SimulationsPage() {
  const simulations = await getSimulations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">試算履歴</h2>
        <Badge variant="secondary">{simulations.length} 件</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">日時</th>
                  <th className="pb-2 pr-4 font-medium">法人名</th>
                  <th className="pb-2 pr-4 font-medium">期</th>
                  <th className="pb-2 pr-4 font-medium">主力業種</th>
                  <th className="pb-2 font-medium text-right">P点</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((sim) => (
                  <tr key={sim.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {new Date(sim.createdAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 pr-4">{sim.organizationName}</td>
                    <td className="py-2.5 pr-4">{sim.fiscalYear}</td>
                    <td className="py-2.5 pr-4">{sim.mainIndustry}</td>
                    <td className="py-2.5 text-right font-mono font-medium">
                      {sim.pScore}
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
