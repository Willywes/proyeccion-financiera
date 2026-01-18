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
import { categoryTypeEnum } from "@/server/db/schema";

const formSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  type: z.enum(categoryTypeEnum),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryFormProps {
  onSuccess?: () => void;
}

export function CategoryForm({ onSuccess }: CategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCategory = api.projection.createCategory.useMutation();
  const ctx = api.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "expense",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      await createCategory.mutateAsync({
        name: values.name,
        type: values.type,
        userId: "demo",
      });

      await ctx.projection.getCategories.invalidate();
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Categoría</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Gastos Casa, Sueldo, Ahorros Auto"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({
            field,
          }: {
            field: ControllerRenderProps<FormValues, "type">;
          }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val)}
                defaultValue={field.value as string}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Egreso</SelectItem>
                  <SelectItem value="savings">Ahorro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear Categoría"}
        </Button>
      </form>
    </Form>
  );
}
