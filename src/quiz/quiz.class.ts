import { listQuiz } from './list-quiz'
import { IQuiz } from './quiz.interface'

// Создаю класс викторины, который реализует интерфейс IQuiz.
export class Quiz implements IQuiz {
    // Определяю свойства викторины согласно интерфейсу.
    public readonly id: number;
    public readonly question: string;
    public readonly options: string[];
    public readonly correct: number;
    public readonly explanation: string;
    // Скрытое свойство для отслеживания правильности ответа пользователя.
    private _isCorrect: boolean = false;

    constructor() {
        // Проверяю, есть ли вопросы в списке.
        if (listQuiz.length === 0) {
            // Если список вопросов пуст, инициализирую свойства стандартными значениями.
            this.id = 0;
            this.question = 'Стандартный вопрос отсутствует';
            this.options = ['Опция 1', 'Опция 2', 'Опция 3', 'Опция 4'];
            this.correct = 0; // Предполагаемый правильный ответ
            this.explanation = 'Пояснение отсутствует';
            return;
        };

        // Получаю случайный вопрос из списка.
        const randomQuestion = this.getRandomQuestion();

        // Убеждаюсь, что у вопроса достаточно вариантов ответа.
        if (!randomQuestion.options || randomQuestion.options.length < 4) {
            throw new Error('Недостаточно вариантов ответа для выбранного вопроса.');
        };

        // Инициализирую свойства текущего вопроса выбранным случайным вопросом.
        this.id = randomQuestion.id;
        this.question = randomQuestion.question;
        this.options = randomQuestion.options;
        this.correct = randomQuestion.correct;
        this.explanation = randomQuestion.explanation;
    };

    // Внутренний метод для выбора случайного вопроса из списка.
    private getRandomQuestion(): IQuiz {
        const randomIndex = Math.floor(Math.random() * listQuiz.length);
        return listQuiz[randomIndex];
    };

    // Сеттер для установки правильности ответа пользователя.
    public set isCorrect(value: boolean) {
        this._isCorrect = value
    };

    // Метод для получения HTML-разметки с вопросом и вариантами ответа.
    //! ToDo удалить id 
    public getQuestionAndOptionsHTML(): string {
        // Формирую HTML-разметку с вопросом и вариантами ответа.
        return `<u>id: ${this.id}</u>  <b>Что будет выведено в консоль?</b>\n
<pre>${this.question}</pre>\n\n<b>Варианты ответа:</b>
Вариант 1: ${this.options[0]}
Вариант 2: ${this.options[1]}
Вариант 3: ${this.options[2]}
Вариант 4: ${this.options[3]}`
    };

    // Метод для получения HTML-разметки с результатом ответа пользователя и пояснением.
    //! ToDo удалить id 
    public getIsCorrectAndExplanationHTML(): string {
        // Формирую HTML-разметку с результатом ответа и пояснением.
        return `<u>id: ${this.id}</u>  ${this._isCorrect ? '<b>✅ Вы ответили правильно!</b>' : `<b>🤮 Вы ответили не правильно!
\nПравильный ответ:</b> ${this.options[this.correct]}`}
\n<b>Пояснение:</b>
<tg-spoiler>${this.explanation}</tg-spoiler>`
    };
};