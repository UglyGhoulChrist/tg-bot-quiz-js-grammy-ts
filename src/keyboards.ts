// Подключение клавиатуры
import { Keyboard } from 'grammy';

// Создаю клавиатуру для первого вопроса викторины.
// Пользователю будет предложено нажать кнопку, чтобы начать викторину.
export const keyboardFirstQuiz: Keyboard = new Keyboard()
    .text('Первый вопрос')
    // Использую метод resized(), чтобы клавиатура занимала меньше места.
    .resized();

// Эта клавиатура предназначена для перехода к следующему вопросу.
// Пользователь может использовать эту кнопку, чтобы продолжить викторину после ответа на вопрос.
export const keyboardNextQuiz: Keyboard = new Keyboard()
    .text('Следующий вопрос')
    .resized();

// Клавиатура с вариантами ответов для вопросов викторины.
// Пользователи могут выбрать один из предложенных вариантов ответа.
export const keyboardOptions: Keyboard = new Keyboard()
    .text('Вариант 1')
    .text('Вариант 2')
    .text('Вариант 3')
    .text('Вариант 4')
    .resized();
