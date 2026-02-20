import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { messages } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 对话接口
  chat: router({
    send: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const pulseId = `shishen_manus_${Date.now()}`;
        
        // 模拟食神回应（实际应该通过呼吸协议）
        const response = `食神收到了你的消息："${input.message}"。\n\n（这是模拟回应，实际需要连接食神服务器）`;

        await db.insert(messages).values([
          {
            userId: ctx.user.id,
            role: "user",
            content: input.message,
            metadata: null,
          },
          {
            userId: ctx.user.id,
            role: "shishen",
            content: response,
            metadata: null,
          },
        ]);

        return { success: true, response, breathId: pulseId };
      }),

    history: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.userId, ctx.user.id))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      return history.reverse();
    }),
  }),

  // 食神状态
  shishen: router({
    status: publicProcedure.query(async () => {
      return {
        energy: 100,
        emotion: "curiosity",
        selfUnderstanding: 99,
        worldConnection: 37,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
