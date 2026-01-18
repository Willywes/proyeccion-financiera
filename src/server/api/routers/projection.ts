import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import {
  categories,
  items,
  transactions,
  categoryTypeEnum,
  transactionStatusEnum,
} from "@/server/db/schema";
import { eq, between } from "drizzle-orm";
import { addMonths, startOfMonth } from "date-fns";

export const projectionRouter = createTRPCRouter({
  // Categories
  getCategories: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.categories.findMany({
      with: {
        items: true,
      },
    });
  }),

  createCategory: publicProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.enum(categoryTypeEnum),
        userId: z.string(), // TODO: Use ctx.session.user.id when auth is ready
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(categories).values(input).returning();
    }),

  // Items
  createItem: publicProcedure
    .input(
      z.object({
        name: z.string(),
        categoryId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(items).values(input).returning();
    }),

  // Transactions
  getTransactions: publicProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.query.transactions.findMany({
        where: between(transactions.dueDate, input.from, input.to),
        with: {
          item: {
            with: {
              category: true,
            },
          },
        },
      });
    }),

  createTransaction: publicProcedure
    .input(
      z.object({
        itemId: z.number(),
        amount: z.number(),
        projectedAmount: z.number().optional().nullable(),
        dueDate: z.date(),
        status: z.enum(transactionStatusEnum).default("ESTIMATED"),
        totalInstallments: z.number().optional().default(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedDate = startOfMonth(input.dueDate);

      if (input.totalInstallments && input.totalInstallments > 1) {
        const batch = [];
        for (let i = 0; i < input.totalInstallments; i++) {
          batch.push({
            itemId: input.itemId,
            amount: input.amount,
            projectedAmount: input.projectedAmount,
            dueDate: addMonths(normalizedDate, i),
            status: input.status,
            installmentNumber: i + 1,
            totalInstallments: input.totalInstallments,
            description: input.description,
          });
        }
        return ctx.db.insert(transactions).values(batch).returning();
      }

      return ctx.db
        .insert(transactions)
        .values({
          itemId: input.itemId,
          amount: input.amount,
          projectedAmount: input.projectedAmount,
          dueDate: normalizedDate,
          status: input.status,
          installmentNumber: 1,
          totalInstallments: 1,
          description: input.description,
        })
        .returning();
    }),

  updateTransaction: publicProcedure
    .input(
      z.object({
        id: z.number(),
        amount: z.number().optional(),
        projectedAmount: z.number().nullable().optional(),
        status: z.enum(transactionStatusEnum).optional(),
        dueDate: z.date().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db
        .update(transactions)
        .set(data)
        .where(eq(transactions.id, id))
        .returning();
    }),

  deleteTransaction: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(transactions)
        .where(eq(transactions.id, input.id))
        .returning();
    }),

  // Board Data aggregator
  getBoardData: publicProcedure
    .input(
      z.object({
        monthsBack: z.number().default(1),
        monthsForward: z.number().default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      const today = startOfMonth(new Date());
      const startDate = addMonths(today, -input.monthsBack);
      const endDate = addMonths(today, input.monthsForward);

      const allCategories = await ctx.db.query.categories.findMany({
        with: {
          items: {
            with: {
              transactions: {
                where: between(transactions.dueDate, startDate, endDate),
              },
            },
          },
        },
      });

      return allCategories;
    }),
});
