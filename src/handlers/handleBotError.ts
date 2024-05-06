import { BotError, GrammyError, HttpError } from "grammy";
import { MyContext } from "../bot";

export async function handleBotError(err: BotError<MyContext>): Promise<void> {
    const ctx: MyContext = err.ctx
    console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`)
    const e = err.error
    if (e instanceof GrammyError) {
        console.error('Ошибка в запросе:', e.description)
    } else if (e instanceof HttpError) {
        console.error('Не удалось связаться с Telegram:', e)
    } else {
        console.error('Неизвестная ошибка:', e)
    }
}