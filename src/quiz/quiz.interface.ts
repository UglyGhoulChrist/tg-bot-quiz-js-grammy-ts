// Описываю интерфейс для объекта викторины.
export interface IQuiz {
    // Уникальный идентификатор вопроса.
    readonly id: number
    // Текст вопроса.
    readonly question: string
    // Массив вариантов ответа.
    readonly options: string[]
    // Индекс правильного ответа из массива вариантов ответа.
    readonly correct: number
    // Объяснение, почему именно этот ответ верный.
    readonly explanation: string
}