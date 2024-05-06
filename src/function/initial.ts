import { Quiz } from "../quiz.class";
import { ISessionData } from "../sessionData.interface";

// Инициализация начального значения сессии
export function initial(): ISessionData {
    return { quiz: new Quiz(), userState: { countQuiz: 0, correctAnswer: 0 } };
}