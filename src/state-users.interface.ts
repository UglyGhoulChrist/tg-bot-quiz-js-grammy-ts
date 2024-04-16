// Определяю тип для состояния одного пользователя
interface IStateUser {
    countQuiz: number;
    correctAnswer: number;
}

// Определяю тип для объекта состояния, где ключ - это строка, а значение - тип UserState
export interface IStateUsers {
    [userId: string]: IStateUser;
}