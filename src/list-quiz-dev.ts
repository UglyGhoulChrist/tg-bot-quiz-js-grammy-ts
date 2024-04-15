// 4 простых вопроса для проверки правильности выбора ответа

import { IQuiz } from "./quiz.interface"

export const listQuiz: IQuiz[] = [
    {
        id: 0,
        question: "console.log(1)",
        options: ["1", "2", "3", "4"],
        correct: 0,
        explanation: "Это очевидно: console.log(1) выведет 1"
    },
    {
        id: 1,
        question: "console.log('b')",
        options: ["a", "b", "c", "d"],
        correct: 1,
        explanation: "Это очевидно: console.log(b) выведет 'b'"
    },
    {
        id: 2,
        question: "console.log(true)",
        options: ["false", "1", "true", "b"],
        correct: 2,
        explanation: "Это очевидно: console.log(true) выведет true"
    },
    {
        id: 3,
        question: "console.log(false)",
        options: ["true", "1", "e", "false"],
        correct: 3,
        explanation: "Это очевидно: console.log(false) выведет false"
    },
]