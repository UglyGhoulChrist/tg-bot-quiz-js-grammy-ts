import { listQuiz } from './list-quiz-dev'
import { IQuiz } from './quiz.interface'

export class Quiz implements IQuiz {
    id: number
    question: string
    options: string[]
    correct: number
    explanation: string
    _isCorrect: boolean = false

    constructor() {
        const randomIndex = Math.floor(Math.random() * listQuiz.length)
        const randomQuestion = listQuiz[randomIndex]
        this.id = randomQuestion.id
        this.question = randomQuestion.question
        this.options = randomQuestion.options
        this.correct = randomQuestion.correct
        this.explanation = randomQuestion.explanation
        // Значение по умолчанию - неверный ответ
        this._isCorrect = false
    }

    set isCorrect(value: number) {
        if (value in [0, 1, 2, 3]) {
            this._isCorrect = value === this.correct
        } else {
            console.error('Значение должно быть `0`, `1`, `2` или `3`')
        }
    }

    // Получение HTML с вопросом и списком вариантов ответа
    getQuestionAndOptionsHTML() {
        return `<b>Что будет выведено в консоль?</b>\n
<pre><code>${this.question}</code></pre>\n
<b>Варианты ответа:</b>
Вариант 1: ${this.options[0]}
Вариант 2: ${this.options[1]}
Вариант 3: ${this.options[2]}
Вариант 4: ${this.options[3]}`
    }

    // Получение HTML правильности ответа пользователя и пояснение вопроса
    getIsCorrectAndExplanationHTML() {
        return `<b>${this._isCorrect ? '✅ Вы ответили правильно!' : '🤮 Вы ответили не правильно!'}
\nПояснение:</b>
<span class='tg-spoiler'>${this.explanation}</span>`
    }
}