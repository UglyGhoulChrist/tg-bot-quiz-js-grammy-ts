// Загружаю переменные окружения из файла .env в process.env
import { config } from 'dotenv';
config();

// Подключаю библиотеку grammy для создания и управления Telegram-ботом на Node.js.
import { Api, Bot, Context, session, SessionFlavor, RawApi } from 'grammy';

// Импортирую команды, которые бот будет распознавать и обрабатывать.
import { commands } from './commands/commands';

// Импортирую текстовые константы.
import { descriptionBadMessage } from './constants';

// Импортирую обработчики для различных команд и действий пользователя.
import { handleHelpCommand } from './handlers/handleHelpCommand';
import { handleStartCommand } from './handlers/handleStartCommand';
import { handleBotError } from './handlers/handleBotError';
import { handleProgressCommand } from './handlers/handleProgressCommand';
import { handleAnswerButtonClick } from './handlers/handleAnswerButtonClick';

// Импортирую функцию для начала игры.
import { startGame } from './quiz/startGame';

// Импортирую начальное состояние сессии.
import { initial } from './session/initial';

// Импортирую интерфейс для данных сессии.
import { ISessionData } from './session/sessionData.interface';

// Расширяю тип контекста для включения данных сессии, чтобы каждый пользователь имел своё состояние в боте.
export type MyContext = Context & SessionFlavor<ISessionData>;

// Создаю экземпляр бота, используя токен, который хранится в переменных окружения под именем BOT_TOKEN.
const bot: Bot<MyContext, Api<RawApi>> = new Bot<MyContext>(process.env.BOT_TOKEN as string);

// Настраиваю команды бота.
bot.api.setMyCommands(commands);

// Подключаю middleware для работы с сессиями.
bot.use(session({ initial }));

// Обрабатываю сообщения, содержащие слово "вопрос", и запускаю игру.
bot.hears(/.*вопрос$/i, startGame);

// Обрабатываю нажатия на кнопки с вариантами ответов.
bot.hears(/^Вариант (\d)$/i, handleAnswerButtonClick);

// Обрабатываю команду /help.
bot.command('help', handleHelpCommand);

// Обрабатываю команду /start.
bot.command('start', handleStartCommand);

// Обрабатываю команду /question, чтобы начать или продолжить игру.
bot.command('question', startGame);

// Обрабатываю команду /progress, чтобы показать пользователю его текущий прогресс в игре.
bot.command('progress', handleProgressCommand);

// Обрабатываю все остальные текстовые сообщения.
bot.on('message', async (ctx) => {
    await ctx.reply(descriptionBadMessage);
})

// Обрабатываю ошибки в работе бота.
bot.catch(handleBotError);

// Запускаю бота.
bot.start();
