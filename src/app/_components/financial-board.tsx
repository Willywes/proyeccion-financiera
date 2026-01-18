"use client";

import React, { useState, useMemo } from "react";
import { api, type RouterOutputs } from "@/trpc/react";
import { format, addMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Edit2,
  Save,
  Info,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionForm } from "./transaction-form";
import { CategoryForm } from "./category-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

const STATUS_COLORS = {
  PENDING: "bg-red-500 text-white hover:bg-red-600",
  ESTIMATED:
    "bg-orange-100 text-orange-900 border-orange-200 hover:bg-orange-200",
  CONFIRMED: "bg-green-100 text-green-900 border-green-200 hover:bg-green-200",
  PAID: "bg-green-600 text-white hover:bg-green-700",
} as const;

type TransactionStatus = keyof typeof STATUS_COLORS;

type BoardData = RouterOutputs["projection"]["getBoardData"];
type Category = BoardData[number];
type Item = Category["items"][number];
type Transaction = Item["transactions"][number];

export function FinancialBoard() {
  const [monthsBack, setMonthsBack] = useState(1);
  const [monthsForward, setMonthsForward] = useState(12);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Edit State
  const [editForm, setEditForm] = useState<{
    id?: number;
    itemId?: number;
    dueDate?: Date;
    amount: number;
    projectedAmount: number | null;
    status: TransactionStatus;
    description: string | null;
  } | null>(null);

  const { data: categories, isLoading } = api.projection.getBoardData.useQuery({
    monthsBack,
    monthsForward,
  });

  const utils = api.useUtils();

  const updateTransaction = api.projection.updateTransaction.useMutation({
    onSuccess: () => {
      void utils.projection.getBoardData.invalidate();
      setEditForm(null);
    },
  });

  const createTransaction = api.projection.createTransaction.useMutation({
    onSuccess: () => {
      void utils.projection.getBoardData.invalidate();
      setEditForm(null);
    },
  });

  const deleteTransaction = api.projection.deleteTransaction.useMutation({
    onSuccess: () => {
      void utils.projection.getBoardData.invalidate();
    },
  });

  const monthColumns = useMemo(() => {
    const columns: Date[] = [];
    const today = startOfMonth(new Date());
    for (let i = -monthsBack; i <= monthsForward; i++) {
      columns.push(addMonths(today, i));
    }
    return columns;
  }, [monthsBack, monthsForward]);

  const currentMonthTotals = useMemo(() => {
    if (!categories) return { income: 0, expense: 0, balance: 0 };
    const today = startOfMonth(new Date());

    const income = categories
      .filter((c) => c.type === "income")
      .reduce(
        (acc: number, c) =>
          acc +
          c.items.reduce((iAcc: number, item) => {
            const t = item.transactions.find(
              (t) =>
                format(new Date(t.dueDate), "yyyy-MM") ===
                format(today, "yyyy-MM"),
            );
            return iAcc + (t?.amount ?? 0);
          }, 0),
        0,
      );

    const expense = categories
      .filter((c) => c.type === "expense")
      .reduce(
        (acc: number, c) =>
          acc +
          c.items.reduce((iAcc: number, item) => {
            const t = item.transactions.find(
              (t) =>
                format(new Date(t.dueDate), "yyyy-MM") ===
                format(today, "yyyy-MM"),
            );
            return iAcc + (t?.amount ?? 0);
          }, 0),
        0,
      );

    return { income, expense, balance: income - expense };
  }, [categories]);

  const getTransactionInfo = (item: Item, month: Date) => {
    const t = item.transactions.find(
      (t) =>
        format(new Date(t.dueDate), "yyyy-MM") === format(month, "yyyy-MM"),
    );
    return {
      transaction: t,
      amount: t?.amount ?? 0,
      projectedAmount: t?.projectedAmount ?? null,
      status: t?.status ?? "ESTIMATED",
      isExisting: !!t,
      description: t?.description ?? null,
      installment:
        t?.totalInstallments && t.totalInstallments > 1
          ? `${t.installmentNumber}/${t.totalInstallments}`
          : null,
    };
  };

  const handleEditClick = (t: Transaction) => {
    setEditForm({
      id: t.id,
      amount: t.amount,
      projectedAmount: t.projectedAmount,
      status: t.status,
      description: t.description,
    });
  };

  const handleCreateClick = (itemId: number, dueDate: Date) => {
    setEditForm({
      itemId,
      dueDate,
      amount: 0,
      projectedAmount: null,
      status: "ESTIMATED",
      description: null,
    });
  };

  const handleSaveAction = async () => {
    if (!editForm) return;

    if (editForm.id) {
      // Update
      await updateTransaction.mutateAsync({
        id: editForm.id,
        amount: editForm.amount,
        projectedAmount: editForm.projectedAmount,
        status: editForm.status,
        description: editForm.description,
      });
    } else if (editForm.itemId && editForm.dueDate) {
      // Create
      await createTransaction.mutateAsync({
        itemId: editForm.itemId,
        dueDate: editForm.dueDate,
        amount: editForm.amount,
        projectedAmount: editForm.projectedAmount,
        status: editForm.status,
        description: editForm.description ?? undefined,
      });
    }
  };

  const renderCategoryGroup = (
    title: string,
    icon: React.ReactNode,
    cats: Category[],
  ) => {
    if (!cats || cats.length === 0) return null;

    return (
      <>
        <TableRow className="bg-muted/30 border-muted hover:bg-muted/30 border-y-2">
          <TableCell colSpan={monthColumns.length + 1} className="py-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-black tracking-widest uppercase">
              {icon}
              {title}
            </div>
          </TableCell>
        </TableRow>
        {cats.map((cat) => (
          <React.Fragment key={cat.id}>
            <TableRow className="bg-muted/10 border-muted border-b font-bold">
              <TableCell className="bg-muted/10 sticky left-0 z-10 min-w-[200px] border-r">
                {cat.name}
              </TableCell>
              {monthColumns.map((month) => {
                const total = cat.items.reduce((acc, item) => {
                  const info = getTransactionInfo(item, month);
                  return acc + info.amount;
                }, 0);
                return (
                  <TableCell
                    key={month.toISOString()}
                    className="border-r text-right text-xs font-black tabular-nums"
                  >
                    ${total.toLocaleString("es-CL")}
                  </TableCell>
                );
              })}
            </TableRow>
            {cat.items.map((item) => (
              <TableRow
                key={item.id}
                className="hover:bg-muted/5 group border-muted/50 border-b"
              >
                <TableCell className="bg-background group-hover:bg-muted/5 sticky left-0 z-10 border-r pl-6 text-sm transition-colors">
                  {item.name}
                </TableCell>
                {monthColumns.map((month) => {
                  const {
                    transaction,
                    amount,
                    projectedAmount,
                    status,
                    isExisting,
                    installment,
                    description,
                  } = getTransactionInfo(item, month);

                  return (
                    <TableCell
                      key={month.toISOString()}
                      className={cn(
                        "group relative h-10 border-r text-right text-xs tabular-nums transition-all",
                        isExisting && STATUS_COLORS[status],
                        !isExisting &&
                          "text-muted-foreground/30 hover:bg-muted/10",
                      )}
                    >
                      <div className="flex flex-col items-end">
                        <span className="font-medium">
                          {isExisting || amount > 0
                            ? `$${amount.toLocaleString("es-CL")}`
                            : "-"}
                        </span>
                        {projectedAmount !== null &&
                          projectedAmount !== amount && (
                            <span className="text-[9px] leading-none opacity-40">
                              (Est: ${projectedAmount.toLocaleString("es-CL")})
                            </span>
                          )}
                      </div>
                      {installment && (
                        <span className="absolute right-1 bottom-0.5 text-[8px] font-bold opacity-50">
                          {installment}
                        </span>
                      )}

                      <div className="absolute top-0.5 right-1 z-20 flex items-center gap-1 opacity-100 transition-opacity">
                        {description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help rounded-full bg-blue-100 p-1 text-blue-600 shadow-md transition-all hover:scale-110 hover:bg-blue-200">
                                <Info className="h-3.5 w-3.5" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[200px] border-blue-200 bg-white p-3 text-xs text-slate-700 shadow-2xl"
                            >
                              <div className="mb-2 flex items-center gap-2 border-b pb-1 text-blue-600">
                                <Info className="h-3 w-3" />
                                <p className="text-[10px] font-bold tracking-wider uppercase">
                                  Información
                                </p>
                              </div>
                              <p className="leading-relaxed">{description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        <div className="border-muted/20 flex items-center gap-1 rounded-full border bg-white/80 px-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                          {isExisting && transaction ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-primary/10 hover:text-primary h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(transaction);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-red-500/10 hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("¿Eliminar este registro?")) {
                                    deleteTransaction.mutate({
                                      id: transaction.id,
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-primary/10 hover:text-primary h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateClick(item.id, month);
                              }}
                            >
                              <Plus className="h-3 w-3 opacity-50" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </React.Fragment>
        ))}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-20">
        <div className="border-primary h-12 w-12 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground animate-pulse">
          Cargando proyecciones financieras...
        </p>
      </div>
    );
  }

  const groupedCategories = {
    income: categories?.filter((c) => c.type === "income") ?? [],
    expense: categories?.filter((c) => c.type === "expense") ?? [],
    savings: categories?.filter((c) => c.type === "savings") ?? [],
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-green-100 bg-green-50/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold tracking-wider text-green-700 uppercase">
                  Ingresos Totales (Mes)
                </p>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-green-900">
                ${currentMonthTotals.income.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-100 bg-red-50/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold tracking-wider text-red-700 uppercase">
                  Gastos Totales (Mes)
                </p>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-red-900">
                ${currentMonthTotals.expense.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold tracking-wider text-blue-700 uppercase">
                  Balance Neto
                </p>
                <PiggyBank className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-blue-900">
                ${currentMonthTotals.balance.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-background/50 border-muted overflow-hidden border border-none shadow-xl backdrop-blur-sm">
          <CardHeader className="bg-muted/20 flex flex-row items-center justify-between border-b px-6 pb-4">
            <div>
              <CardTitle className="text-xl font-black tracking-tight uppercase">
                Matriz de Proyección
              </CardTitle>
              <p className="text-muted-foreground text-xs font-medium">
                Visualización mes a mes de tu flujo de caja
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-background flex scale-90 items-center gap-4 rounded-full border px-4 py-1.5 md:scale-100">
                <button
                  onClick={() => setMonthsBack((m) => m + 1)}
                  className="hover:text-primary hover:bg-muted rounded-full p-1 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-20 text-center text-[10px] font-black tracking-tighter uppercase">
                  VISTA: {monthsBack} <span className="mx-1 opacity-30">/</span>{" "}
                  {monthsForward}
                </span>
                <button
                  onClick={() => setMonthsForward((m) => m + 1)}
                  className="hover:text-primary hover:bg-muted rounded-full p-1 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="shadow-primary/20 rounded-full px-6 font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Nuevo Registro
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Gestión de Finanzas</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="transaction" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="transaction">Transacción</TabsTrigger>
                      <TabsTrigger value="category">Categoría</TabsTrigger>
                    </TabsList>
                    <TabsContent value="transaction">
                      <TransactionForm
                        onSuccess={() => setIsDialogOpen(false)}
                      />
                    </TabsContent>
                    <TabsContent value="category">
                      <CategoryForm onSuccess={() => setIsDialogOpen(false)} />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="bg-muted/40 border-muted sticky left-0 z-20 min-w-[200px] border-r border-b text-xs font-black uppercase">
                      Concepto
                    </TableHead>
                    {monthColumns.map((month) => (
                      <TableHead
                        key={month.toISOString()}
                        className="text-muted-foreground border-muted min-w-[120px] border-r border-b text-center text-[10px] font-black tracking-[0.2em] uppercase"
                      >
                        {format(month, "MMM yyyy", { locale: es })}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderCategoryGroup(
                    "INGRESOS",
                    <TrendingUp className="h-3 w-3" />,
                    groupedCategories.income,
                  )}
                  {renderCategoryGroup(
                    "EGRESOS",
                    <TrendingDown className="h-3 w-3" />,
                    groupedCategories.expense,
                  )}
                  {renderCategoryGroup(
                    "AHORROS",
                    <PiggyBank className="h-3 w-3" />,
                    groupedCategories.savings,
                  )}

                  <TableRow className="border-t-2 border-zinc-800 bg-zinc-950 font-black text-white hover:bg-zinc-900">
                    <TableCell className="sticky left-0 z-10 border-r border-zinc-800 bg-zinc-950 text-sm italic">
                      BALANCE NETO
                    </TableCell>
                    {monthColumns.map((month) => {
                      const income = groupedCategories.income.reduce(
                        (acc: number, c) =>
                          acc +
                          c.items.reduce((iAcc: number, item) => {
                            const info = getTransactionInfo(item, month);
                            return iAcc + info.amount;
                          }, 0),
                        0,
                      );

                      const expense = groupedCategories.expense.reduce(
                        (acc: number, c) =>
                          acc +
                          c.items.reduce((iAcc: number, item) => {
                            const info = getTransactionInfo(item, month);
                            return iAcc + info.amount;
                          }, 0),
                        0,
                      );

                      const balance = income - expense;
                      return (
                        <TableCell
                          key={month.toISOString()}
                          className="border-r border-zinc-800 text-right text-xs tabular-nums"
                        >
                          ${balance.toLocaleString("es-CL")}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Create / Edit Dialog */}
        <Dialog
          open={!!editForm}
          onOpenChange={(open) => !open && setEditForm(null)}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {editForm?.id ? "Editar Registro" : "Nuevo Registro Mensual"}
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
                {editForm?.id
                  ? "Actualiza el estado o monto de esta transacción."
                  : "Asigna un monto proyectado para este mes."}
              </p>
            </DialogHeader>
            {editForm && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) =>
                      setEditForm({
                        ...editForm,
                        status: val as TransactionStatus,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESTIMATED">Estimado</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                      <SelectItem value="PAID">Pagado</SelectItem>
                      <SelectItem value="PENDING">
                        Pendiente / Atrasado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Monto{" "}
                      {editForm.status === "ESTIMATED" ? "Estimado" : "Final"}
                    </Label>
                    <Input
                      type="number"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          amount: Number(e.target.value),
                        })
                      }
                      autoFocus={!editForm.id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground opacity-70">
                      Monto Proyectado (Opcional)
                    </Label>
                    <Input
                      type="number"
                      value={editForm.projectedAmount ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          projectedAmount:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                      placeholder="Para comparar..."
                      className="bg-muted/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nota / Comentario</Label>
                  <Textarea
                    placeholder="Añade algún detalle sobre esta transacción..."
                    value={editForm.description ?? ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        description: e.target.value || null,
                      })
                    }
                    className="resize-none text-xs"
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditForm(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveAction}
                disabled={
                  updateTransaction.isPending || createTransaction.isPending
                }
              >
                {updateTransaction.isPending || createTransaction.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    {editForm?.id ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {editForm?.id ? "Guardar Cambios" : "Crear Registro"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
