"use client";

import { useForm, type ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/trpc/react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const formSchema = z.object({
  categoryId: z.string().min(1, "Selecciona una categoría"),
  itemName: z.string().min(2, "Mínimo 2 caracteres"),
  amount: z.string().refine((val) => !isNaN(Number(val)), "Debe ser un número"),
  dueDate: z.string(),
  installments: z.string(),
  description: z.string().optional(),
});

type FormValues = {
  categoryId: string;
  itemName: string;
  amount: string;
  dueDate: string;
  installments: string;
  description?: string;
};

interface TransactionFormProps {
  onSuccess?: () => void;
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: categories } = api.projection.getCategories.useQuery();

  const createItem = api.projection.createItem.useMutation();
  const createTransaction = api.projection.createTransaction.useMutation();

  const ctx = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "",
      itemName: "",
      amount: "",
      dueDate: new Date().toISOString().split("T")[0],
      installments: "1",
      description: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const categoryIdNum = Number(values.categoryId);
      const existingItem = categories
        ?.find((c) => c.id === categoryIdNum)
        ?.items.find((i) => i.name === values.itemName);

      let itemId: number;
      if (existingItem) {
        itemId = existingItem.id;
      } else {
        const newItem = await createItem.mutateAsync({
          name: values.itemName,
          categoryId: categoryIdNum,
        });
        if (!newItem[0]) throw new Error("Error al crear ítem");
        itemId = newItem[0].id;
      }

      await createTransaction.mutateAsync({
        itemId,
        projectedAmount: Number(values.amount),
        dueDate: new Date(values.dueDate),
        totalInstallments: Number(values.installments),
        description: values.description,
      });

      await ctx.projection.getBoardData.invalidate();
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="categoryId"
          render={({
            field,
          }: {
            field: ControllerRenderProps<FormValues, "categoryId">;
          }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val)}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name} ({c.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="itemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ítem / Concepto</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Pago Arriendo, Sueldo..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha Pago</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="installments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cuotas (1 para pago único)</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Transacción"}
        </Button>
      </form>
    </Form>
  );
}
