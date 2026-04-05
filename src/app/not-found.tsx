import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <p className="text-6xl font-bold text-muted-foreground/30">404</p>
            <CardTitle className="mt-4 text-xl">
              ページが見つかりません
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              お探しのページは移動または削除された可能性があります。
            </p>
            <Link href="/">
              <Button>
                <Home className="mr-2 h-4 w-4" />
                トップページへ戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </>
  );
}
