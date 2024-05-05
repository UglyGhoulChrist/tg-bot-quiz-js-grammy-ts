// Подключение модуля, который позволяет загружать переменные окружения из файла `.env` в `process.env`.
import { config } from 'dotenv'
config()

// Подключение библиотеки `grammy`, для создания Telegram-ботов на Node.js
import { Api, Bot, BotError, CommandContext, Context, session, SessionFlavor, GrammyError, HearsContext, HttpError, RawApi } from 'grammy'
// Подключение команд
import { commands } from './commands'
// Подключение констант с текстом
import { descriptionStart, descriptionHelp, descriptionBadMessage } from './constants'
// Импорт Class Quiz
import { Quiz } from './quiz.class'
// Подключение клавиатур
import { keyboardFirstQuiz, keyboardNextQuiz, keyboardOptions } from './keyboards'
import { IUserState } from './userState.interface';

// Определение формы сессии
interface SessionData {
    quiz: Quiz;
    userState: IUserState;
}

// Расширение типа контекста для включения сессий
type MyContext = Context & SessionFlavor<SessionData>;

// Создание нового экземпляра бота, токен для которого берется из переменных окружения (`BOT_TOKEN`)
const bot: Bot<MyContext, Api<RawApi>> = new Bot<MyContext>(process.env.BOT_TOKEN as string)

// Инициализация команд бота
bot.api.setMyCommands(commands)

// Инициализация начального значения сессии
function initial(): SessionData {
    return { quiz: new Quiz(), userState: { countQuiz: 0, correctAnswer: 0 } };
}

// Использование промежуточного обработчика сессии
bot.use(session({ initial }));

// Старт игры
const startGame = async (ctx: MyContext): Promise<void> => {

    // Получение вопроса
    ctx.session.quiz = new Quiz();

    // Отправка сообщения с текстом вопроса, вариантами ответа и клавиатурой с кнопками выбора ответа
    await ctx.reply(ctx.session.quiz.getQuestionAndOptionsHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardOptions
    })
}

// Обработка нажатия на кнопки `Первый вопрос` или `Следующий вопрос`
bot.hears(['Первый вопрос', 'Следующий вопрос'], async (ctx: HearsContext<MyContext>) => {
    startGame(ctx)
})

// Обработка нажатия на кнопки вариантов ответа
bot.hears(/^Вариант (\d)$/, async (ctx) => {

    if (!ctx.session.quiz) {
        await ctx.reply('Сначала начните игру командой /question.');
        return;
    }

    const selectedOption: number = parseInt(ctx.match[1]);
    ctx.session.quiz.isCorrect = ctx.session.quiz.correct === selectedOption - 1;

    await ctx.reply(ctx.session.quiz.getIsCorrectAndExplanationHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardNextQuiz
    });
});



// Обработка команды `/help`
bot.command('help', async (ctx: CommandContext<MyContext>) => {
    await ctx.reply(descriptionHelp, { parse_mode: 'HTML' })
})

// Обработка команды `/start`
bot.command('start', async (ctx: CommandContext<MyContext>) => {
    await ctx.reply(descriptionStart, {
        parse_mode: 'HTML',
        reply_markup: keyboardFirstQuiz
    })
})

// Обработка команды `/question`
bot.command('question', async (ctx: CommandContext<MyContext>) => {
    await startGame(ctx)
})

// Обработка команды /progress
bot.command('progress', async (ctx) => {
    const state: IUserState = ctx.session.userState;
    await ctx.reply(`Вы ответили правильно на ${state.correctAnswer} из ${state.countQuiz} вопросов викторины!`);
});

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
