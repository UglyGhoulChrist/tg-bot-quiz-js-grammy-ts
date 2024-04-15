// Подключение модуля, который позволяет загружать переменные окружения из файла `.env` в `process.env`.
import { config } from 'dotenv'
config()
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
    if (typeof ctx.match === 'string') {
        quiz.isCorrect = parseInt(ctx.match.split(' ')[1]) - 1;
        // Отправка сообщения с правильностью ответа пользователем и пояснение ответа
        await ctx.reply(quiz.getIsCorrectAndExplanationHTML(), {
            parse_mode: 'HTML',
            reply_markup: keyboardNextQuiz
        });
    } else {
        console.error('ctx.match должен быть строкой');
    }
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
