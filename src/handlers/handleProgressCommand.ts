import { CommandContext } from "grammy";
import { MyContext } from "../bot";
import { IUserState } from "../userState/userState.interface";
import { getUserId } from "../userState/getUserId";
import { UserState } from "../userState/userState.class";

export async function handleProgressCommand(ctx: CommandContext<MyContext>): Promise<void> {

    const userId: number | undefined = await getUserId(ctx);

    if (userId) {
        // Загрузка состояния пользователя из файла
        const userState: IUserState = await new UserState().getUserState(userId);

        try {
            // Отправка сообщения с текущим прогрессом пользователя
            await ctx.reply(`Вы ответили правильно на ${userState.correctAnswer} из ${userState.countQuiz} вопросов викторины!`);
        } catch (error) {
            if (error instanceof Error) {
                console.log(error.message);
            } else {
                console.log('Произошла неизвестная ошибка');
            }
        }
    }
}