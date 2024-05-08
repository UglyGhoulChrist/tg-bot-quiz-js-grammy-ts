import { Quiz } from "../quiz/quiz.class";
import { ISessionData } from "./sessionData.interface";

// Задаю функцию для инициализации начального состояния сессии каждого пользователя.
export function initial(): ISessionData {
    return { quiz: new Quiz() };
}