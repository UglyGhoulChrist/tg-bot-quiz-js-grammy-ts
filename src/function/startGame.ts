import { MyContext } from "../bot";
import { keyboardOptions } from "../keyboards";
import { Quiz } from "../quiz.class";

// Старт игры
export async function startGame(ctx: MyContext): Promise<void> {

    // Получение вопроса
    ctx.session.quiz = new Quiz();

    // Отправка сообщения с текстом вопроса, вариантами ответа и клавиатурой с кнопками выбора ответа
    await ctx.reply(ctx.session.quiz.getQuestionAndOptionsHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardOptions
    })
}