import { Quiz } from "../quiz/quiz.class";
import { ISessionData } from "./sessionData.interface";

// Инициализация начального значения сессии
export function initial(): ISessionData {
    return { quiz: new Quiz() };
}