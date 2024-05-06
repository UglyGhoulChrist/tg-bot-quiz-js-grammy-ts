// Подключение модуля, который позволяет загружать переменные окружения из файла `.env` в `process.env`.
import { config } from 'dotenv'
config()

// Подключение библиотеки `grammy`, для создания Telegram-ботов на Node.js
import { Api, Bot, Context, session, SessionFlavor, RawApi } from 'grammy'
// Подключение команд
import { commands } from './commands'
// Подключение констант с текстом
import { descriptionBadMessage } from './constants'
import { handleHelpCommand } from './handlers/handleHelpCommand'
import { handleStartCommand } from './handlers/handleStartCommand'
import { handleBotError } from './handlers/handleBotError'
import { handleProgressCommand } from './handlers/handleProgressCommand'
import { handleAnswerButtonClick } from './handlers/handleAnswerButtonClick'
import { startGame } from './function/startGame'
import { initial } from './function/initial'
import { ISessionData } from './sessionData.interface'
import { UserState } from './userState.class'

// Расширение типа контекста для включения сессий
export type MyContext = Context & SessionFlavor<ISessionData>;

// Создание нового экземпляра бота, токен для которого берется из переменных окружения (`BOT_TOKEN`)
const bot: Bot<MyContext, Api<RawApi>> = new Bot<MyContext>(process.env.BOT_TOKEN as string)

// Инициализация команд бота
bot.api.setMyCommands(commands)

// Использование промежуточного обработчика сессии
bot.use(session({ initial }));

export const userState = new UserState();

// Обработка нажатия на кнопки `Первый вопрос` или `Следующий вопрос`
bot.hears(/.*вопрос$/i, startGame)

// Обработка нажатия на кнопки вариантов ответа
bot.hears(/^Вариант (\d)$/i, handleAnswerButtonClick);

// Обработка команды `/help`
bot.command('help', handleHelpCommand)

// Обработка команды `/start`
bot.command('start', handleStartCommand)

// Обработка команды `/question`
bot.command('question', startGame)

// Обработка команды /progress
bot.command('progress', handleProgressCommand);

// Обработка всех остальных сообщений
bot.on('message', async (ctx) => {
    await ctx.reply(descriptionBadMessage)
})

// Обработка ошибок
bot.catch(handleBotError)

// Запуск бота
bot.start()
