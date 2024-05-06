import { MyContext } from "../bot";

// Функция для проверки идентификации пользователя
export async function getUserId(ctx: MyContext): Promise<number | undefined> {
    const userId = ctx.from?.id;
    if (!userId) {
        await ctx.reply('Не удалось идентифицировать пользователя.');
    }
    return userId;
}