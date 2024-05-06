import { Quiz } from "./quiz.class";
import { IUserState } from "./userState.interface";

// Определение формы сессии
export interface ISessionData {
    quiz: Quiz;
    userState: IUserState;
}