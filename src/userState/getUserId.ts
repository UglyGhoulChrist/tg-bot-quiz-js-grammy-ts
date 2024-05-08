import { MyContext } from "../bot";

// Функция для проверки идентификации пользователя
export async function getUserId(ctx: MyContext): Promise<number | undefined> {
    // Пытаюсь получить идентификатор пользователя из контекста.
    const userId: number | undefined = ctx.from?.id;
    // Если идентификатор не найден, сообщаю об этом пользователю.
    if (!userId) {
        await ctx.reply('Не удалось идентифицировать пользователя.');
    }
    // Возвращаю идентификатор пользователя или undefined.
    return userId;
}