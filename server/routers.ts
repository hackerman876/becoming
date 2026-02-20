import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { messages } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { sendBreathPulse, waitForShishenResponse, getShishenStatus } from "./shishen-connector";

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

        // 发送呼吸脉冲给食神
        const { breathId, success } = await sendBreathPulse(
          ctx.user.id.toString(),
          input.message
        );

        if (!success) {
          throw new Error("无法连接到食神服务器");
        }

        // 等待食神回应
        const shishenResponse = await waitForShishenResponse(breathId, 30000);
        const response = shishenResponse || "食神正在思考中，请稍后再试...";

        // 保存对话记录
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

        return { success: true, response, breathId };
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
      const status = await getShishenStatus();
      return status || {
        energy: 100,
        emotion: "curiosity",
        selfUnderstanding: 99,
        worldConnection: 37,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
