import { HearsContext } from "grammy";
import { MyContext } from "../bot";
import { keyboardNextQuiz } from "../keyboards";
import { getUserId } from "../userState/getUserId";
import { UserState } from "../userState/userState.class";

// Функция обрабатывает выбор вариантов ответа.
export async function handleAnswerButtonClick(ctx: HearsContext<MyContext>): Promise<void> {
    const userId: number | undefined = await getUserId(ctx);
    if (!userId) {
        return;
    };

    // Проверяю, есть ли у пользователя активная викторина. Если нет, предлагаю начать игру.
    if (!ctx.session.quiz) {
        await ctx.reply('Сначала начните игру командой /question.');
        return;
    };

    // Создаю экземпляр класса UserState для работы с состоянием пользователя.
    const userState: UserState = new UserState()

    // Увеличиваю количество пройденных пользователем вопросов.
    await userState.incrementQuizCount(userId);

    // Определяю, какой вариант ответа выбрал пользователь.
    const selectedOption: number = parseInt(ctx.match[1]);
    // Проверяю, правильный ли это ответ.
    const isCorrect: boolean = ctx.session.quiz.correct === selectedOption - 1;
    // Обновляю состояние викторины в сессии, указывая, был ли ответ правильным.
    ctx.session.quiz.isCorrect = isCorrect

    if (isCorrect) {
        // Если ответ правильный, увеличиваю количество правильных ответов пользователя.
        await userState.incrementCorrectAnswer(userId);
    }

    // Отправляю пользователю результат его выбора и пояснение, используя HTML-разметку.
    await ctx.reply(ctx.session.quiz.getIsCorrectAndExplanationHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardNextQuiz
    });
}