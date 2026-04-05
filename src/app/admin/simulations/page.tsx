'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import type { AdminSimulation } from '@/lib/admin/types';

const PAGE_SIZE = 10;

type SortKey = 'createdAt' | 'pScore';
type SortDir = 'asc' | 'desc';

export default function SimulationsPage() {
  const [simulations, setSimulations] = useState<AdminSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    async function fetchSimulations() {
      try {
        const res = await fetch('/api/admin/simulations');
        if (!res.ok) throw new Error('取得に失敗しました');
        const data = await res.json();
        setSimulations(data.simulations);
      } catch {
        showToast('試算履歴の取得に失敗しました', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchSimulations();
  }, []);

  const filteredSimulations = useMemo(() => {
    let result = simulations;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.organizationName.toLowerCase().includes(q) ||
          s.mainIndustry.toLowerCase().includes(q) ||
          s.fiscalYear.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      );
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (sortKey === 'createdAt') {
        const diff =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortDir === 'asc' ? diff : -diff;
      }
      const diff = a.pScore - b.pScore;
      return sortDir === 'asc' ? diff : -diff;
    });
    return result;
  }, [simulations, search, sortKey, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSimulations.length / PAGE_SIZE),
  );
  const paginatedSimulations = useMemo(
    () =>
      filteredSimulations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredSimulations, page],
  );

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">試算履歴</h2>
        <Badge variant="secondary">{simulations.length} 件</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="法人名・業種・IDで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">法人名</th>
                  <th className="pb-2 pr-4 font-medium">主力業種</th>
                  <th className="pb-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => toggleSort('pScore')}
                    >
                      P点
                      <ArrowUpDown className="h-3 w-3" />
                      {sortKey === 'pScore' && (
                        <span className="text-xs">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="pb-2 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => toggleSort('createdAt')}
                    >
                      作成日時
                      <ArrowUpDown className="h-3 w-3" />
                      {sortKey === 'createdAt' && (
                        <span className="text-xs">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSimulations.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {search
                        ? '検索条件に一致する試算がありません'
                        : '試算履歴がありません'}
                    </td>
                  </tr>
                )}
                {paginatedSimulations.map((sim) => (
                  <tr key={sim.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs font-mono">
                      {sim.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 pr-4">{sim.organizationName}</td>
                    <td className="py-2.5 pr-4">{sim.mainIndustry}</td>
                    <td className="py-2.5 pr-4 font-mono font-medium">
                      {sim.pScore}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {new Date(sim.createdAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                {filteredSimulations.length}件中{' '}
                {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filteredSimulations.length)}
                件を表示
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
