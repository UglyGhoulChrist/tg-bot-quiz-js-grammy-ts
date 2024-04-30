import { listQuiz } from './list-quiz-dev'
import { IQuiz } from './quiz.interface'

export class Quiz implements IQuiz {
    public readonly id: number
    public readonly question: string
    public readonly options: string[]
    public readonly correct: number
    public readonly explanation: string
    private _isCorrect: boolean = false

    constructor() {
        if (listQuiz.length === 0) {
            // throw new Error('Список вопросов пуст.');
            this.id = 0;
            this.question = 'Стандартный вопрос отсутствует';
            this.options = ['Опция 1', 'Опция 2', 'Опция 3', 'Опция 4'];
            this.correct = 0; // Предполагаемый правильный ответ
            this.explanation = 'Пояснение отсутствует';
            return;
        }

        const randomQuestion = this.getRandomQuestion();

        if (!randomQuestion.options || randomQuestion.options.length < 4) {
            throw new Error('Недостаточно вариантов ответа для выбранного вопроса.');
        }

        this.id = randomQuestion.id;
        this.question = randomQuestion.question;
        this.options = randomQuestion.options;
        this.correct = randomQuestion.correct;
        this.explanation = randomQuestion.explanation;
    }

    private getRandomQuestion(): IQuiz {
        const randomIndex = Math.floor(Math.random() * listQuiz.length);
        return listQuiz[randomIndex];
    }

    public set isCorrect(value: boolean) {
        this._isCorrect = value
    }

    // Получение HTML с вопросом и списком вариантов ответа
    public getQuestionAndOptionsHTML(): string {
        return `<b>Что будет выведено в консоль?</b>\n
<pre>${this.question}</pre>\n\n<b>Варианты ответа:</b>
Вариант 1: ${this.options[0]}
Вариант 2: ${this.options[1]}
Вариант 3: ${this.options[2]}
Вариант 4: ${this.options[3]}`
    }

    // Получение HTML правильности ответа пользователя и пояснение вопроса
    public getIsCorrectAndExplanationHTML(): string {
        return `<b>${this._isCorrect ? '✅ Вы ответили правильно!' : '🤮 Вы ответили не правильно!'}
\nПояснение:</b>
<span class='tg-spoiler'>${this.explanation}</span>`
    }
}