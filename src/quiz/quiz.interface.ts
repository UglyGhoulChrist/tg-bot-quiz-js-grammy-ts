export interface IQuiz {
    readonly id: number
    readonly question: string
    readonly options: string[]
    readonly correct: number
    readonly explanation: string
}