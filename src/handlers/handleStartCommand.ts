import { CommandContext } from "grammy";
import { MyContext } from "../bot";
import { descriptionStart } from "../constants";
import { keyboardFirstQuiz } from "../keyboards";

// Функция обрабатывает команду /start.
export async function handleStartCommand(ctx: CommandContext<MyContext>): Promise<void> {
    try {
        // Отправляю пользователю приветственное сообщение.
        await ctx.reply(descriptionStart, {
            parse_mode: 'HTML',
            reply_markup: keyboardFirstQuiz
        })
    } catch (error) {
        // Обрабатываю ошибку.
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log('Произошла неизвестная ошибка');
        }
    }
}