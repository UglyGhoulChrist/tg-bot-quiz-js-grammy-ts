// Подключение модуля, который позволяет загружать переменные окружения из файла `.env` в `process.env`.
import { config } from 'dotenv'
config()

import { loadState, saveState } from './state-users'

// Инициализируем состояние
let state: IStateUsers = loadState();

// Подключение библиотеки `grammy`, для создания Telegram-ботов на Node.js
import { Api, Bot, BotError, CommandContext, Context, GrammyError, HearsContext, HttpError, RawApi } from 'grammy'
// Подключение команд
import { commands } from './commands'
// Подключение констант с текстом
import { descriptionStart, descriptionHelp, descriptionBadMessage } from './constants'
// Импорт Class Quiz
import { Quiz } from './quiz.class'
// Подключение клавиатур
import { keyboardFirstQuiz, keyboardNextQuiz, keyboardOptions } from './keyboards'
import { IStateUsers } from './state-users.interface';

// Создание нового экземпляра бота, токен для которого берется из переменных окружения (`BOT_TOKEN`)
const bot: Bot<Context, Api<RawApi>> = new Bot(process.env.BOT_TOKEN as string)
// Инициализация команд бота
bot.api.setMyCommands(commands)
// Получение вопроса
let quiz: Quiz = new Quiz()

// Старт игры
const startGame = async (ctx: Context): Promise<void> => {
    // Получение вопроса
    quiz = new Quiz()
    // Отправка сообщения с текстом вопроса, вариантами ответа и клавиатурой с кнопками выбора ответа
    await ctx.reply(quiz.getQuestionAndOptionsHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardOptions
    })
}

// Обработка нажатия на кнопки `Первый вопрос` или `Следующий вопрос`
bot.hears(['Первый вопрос', 'Следующий вопрос'], async (ctx: HearsContext<Context>) => {
    startGame(ctx)
})

// Обработка нажатия на кнопки вариантов ответа
bot.hears(['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'], async (ctx: HearsContext<Context>) => {

    if (typeof ctx.match !== 'string') {
        console.error('ctx.match должен быть строкой');
        return
    }

    quiz.isCorrect = parseInt(ctx.match.split(' ')[1]) - 1;

    if (ctx.from?.id) {
        const userId = ctx.from.id;
        // Обновляем состояние для пользователя
        if (!state[userId]) {
            // Начальное состояние
            state[userId] = { countQuiz: 0, correctAnswer: 0 };
        }
        // Увеличиваем счетчик quiz
        state[userId].countQuiz += 1;
        // Увеличиваем счетчик правильных ответов
        state[userId].correctAnswer += +quiz._isCorrect
        // Сохраняем обновленное состояние в файл
        await saveState(state);
    }

    // Отправка сообщения с правильностью ответа пользователем и пояснение ответа
    await ctx.reply(quiz.getIsCorrectAndExplanationHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardNextQuiz
    });

    // Возврат функции после обработки нажатия на кнопку вариантов ответа
    return;
});

// Обработка команды `/help`
bot.command('help', async (ctx: CommandContext<Context>) => {
    await ctx.reply(descriptionHelp, { parse_mode: 'HTML' })
})

// Обработка команды `/start`
bot.command('start', async (ctx: CommandContext<Context>) => {
    await ctx.reply(descriptionStart, {
        parse_mode: 'HTML',
        reply_markup: keyboardFirstQuiz
    })
})

// Обработка команды `/question`
bot.command('question', async (ctx: CommandContext<Context>) => {
    await startGame(ctx)
})

// Обработка команды `/progress`
bot.command('progress', async (ctx: CommandContext<Context>) => {
    if (ctx.from?.id) {
        const userId: number = ctx.from.id;
        const stateUser: IStateUsers = loadState()
        if (stateUser[userId]) {
            await ctx.reply(`Вы ответили правильно на ${stateUser[userId].correctAnswer} из ${stateUser[userId].countQuiz} вопросов викторины!`)
        } else {
            await ctx.reply('Вы ещё не ответили ни на один вопрос викторины!')
        }

    }
    return
})

// Обработка всех остальных сообщений
bot.on('message', async (ctx) => {
    await ctx.reply(descriptionBadMessage)
})

// Обработка ошибок
bot.catch((err: BotError<Context>) => {
    const ctx: Context = err.ctx
    console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`)
    const e = err.error
    if (e instanceof GrammyError) {
        console.error('Ошибка в запросе:', e.description)
    } else if (e instanceof HttpError) {
        console.error('Не удалось связаться с Telegram:', e)
    } else {
        console.error('Неизвестная ошибка:', e)
    }
})

// Запуск бота
bot.start()
