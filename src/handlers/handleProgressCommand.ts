import { CommandContext } from "grammy";
import { MyContext, userState } from "../bot";
import { IUserState } from "../userState.interface";
import { getUserId } from "../function/getUserId";

export async function handleProgressCommand(ctx: CommandContext<MyContext>): Promise<void> {

    const userId: number | undefined = await getUserId(ctx);

    if (userId) {
        // Загрузка состояния пользователя из файла

        const state: IUserState = await userState.getUserState(userId);

        try {
            // Отправка сообщения с текущим прогрессом пользователя
            await ctx.reply(`Вы ответили правильно на ${state.correctAnswer} из ${state.countQuiz} вопросов викторины!`);
        } catch (error) {
            if (error instanceof Error) {
                console.log(error.message);
            } else {
                console.log('Произошла неизвестная ошибка');
            }
        }
    }
}