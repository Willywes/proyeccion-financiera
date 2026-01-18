import { auth } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";
import { FinancialBoard } from "@/app/_components/financial-board";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="bg-background text-foreground min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1600px] space-y-8">
          <header className="flex items-center justify-between border-b pb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Finanzas Proyectadas
              </h1>
              <p className="text-muted-foreground">
                Control de ingresos, egresos y proyecciones de ahorro.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session?.user ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{session.user.name}</p>
                </div>
              ) : null}
            </div>
          </header>

          <FinancialBoard />
        </div>
      </main>
    </HydrateClient>
  );
}
