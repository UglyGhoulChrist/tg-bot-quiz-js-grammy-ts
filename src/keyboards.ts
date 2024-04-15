// Подключение клавиатуры
import { Keyboard } from 'grammy'
// Создание клавиатур
export const keyboardFirstQuiz: Keyboard = new Keyboard().text('Первый вопрос').resized()
export const keyboardNextQuiz: Keyboard = new Keyboard().text('Следующий вопрос').resized()
export const keyboardOptions: Keyboard = new Keyboard().text('Вариант 1').text('Вариант 2').text('Вариант 3').text('Вариант 4').resized()
