// Интерфейс для состояния одного пользователя
export interface IUserState {
    countQuiz: number;      // Количество пройденных пользователем викторин
    correctAnswer: number;  // Количество правильных ответов
}

// Интерфейс для состояний всех пользователей
export interface IUsersState {
    [userId: string]: IUserState;  // Маппинг идентификатора пользователя на его состояние
}
