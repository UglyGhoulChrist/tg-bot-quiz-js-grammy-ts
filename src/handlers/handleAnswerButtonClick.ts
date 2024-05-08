import { HearsContext } from "grammy";
import { MyContext } from "../bot";
import { keyboardNextQuiz } from "../keyboards";
import { getUserId } from "../userState/getUserId";
import { UserState } from "../userState/userState.class";

export async function handleAnswerButtonClick(ctx: HearsContext<MyContext>): Promise<void> {
    const userId: number | undefined = await getUserId(ctx);
    if (!userId) {
        return;
    }

    if (!ctx.session.quiz) {
        await ctx.reply('Сначала начните игру командой /question.');
        return;
    }

    // Загрузка состояния пользователя из файла
    const userState: UserState = new UserState()

    // Увеличение количества пройденных вопросов
    await userState.incrementQuizCount(userId);

    const selectedOption: number = parseInt(ctx.match[1]);
    const isCorrect: boolean = ctx.session.quiz.correct === selectedOption - 1;
    ctx.session.quiz.isCorrect = isCorrect

    if (isCorrect) {
        // Увеличение количества правильных ответов
        await userState.incrementCorrectAnswer(userId);
    }

    await ctx.reply(ctx.session.quiz.getIsCorrectAndExplanationHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardNextQuiz
    });
}