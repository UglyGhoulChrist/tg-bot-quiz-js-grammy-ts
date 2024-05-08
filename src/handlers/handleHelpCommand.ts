import { CommandContext } from "grammy";
import { MyContext } from "../bot";
import { descriptionHelp } from "../constants";

// Функция обрабатывает команду /help.
export async function handleHelpCommand(ctx: CommandContext<MyContext>): Promise<void> {
    try {
        await ctx.reply(descriptionHelp, { parse_mode: 'HTML' })
    } catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log('Произошла неизвестная ошибка');
        }
    }
}