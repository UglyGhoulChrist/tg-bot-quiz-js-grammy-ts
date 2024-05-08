import { MyContext } from "../bot";
import { keyboardOptions } from "../keyboards";
import { Quiz } from "./quiz.class";

// Начинаю новую викторину для пользователя.
export async function startGame(ctx: MyContext): Promise<void> {

    // Создаю новый экземпляр викторины и сохраняю его в сессии пользователя.
    ctx.session.quiz = new Quiz();

    // Отправляю пользователю сообщение с текстом вопроса и вариантами ответа.
    await ctx.reply(ctx.session.quiz.getQuestionAndOptionsHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardOptions
    });
};