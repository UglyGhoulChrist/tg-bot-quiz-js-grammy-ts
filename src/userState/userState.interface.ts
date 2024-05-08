// Интерфейс для состояния одного пользователя
export interface IUserState {
    countQuiz: number;      // Количество пройденных пользователем викторин
    correctAnswer: number;  // Количество правильных ответов
}