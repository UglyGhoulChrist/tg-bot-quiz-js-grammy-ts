# Класс Quiz

Класс Quiz реализует интерфейс IQuiz и представляет собой викторину с вопросами по JavaScript.

## Интерфейс IQuiz

Интерфейс IQuiz описывает структуру объекта викторины.

typescript
export interface IQuiz {
    id: number;
    question: string;
    options: string;
    correct: number;
    explanation: string;
}

## Конструктор

При создании экземпляра класса Quiz, конструктор автоматически выбирает случайный вопрос из списка вопросов.

## Свойства

- id: уникальный идентификатор вопроса.
- question: текст вопроса.
- options: массив вариантов ответов.
- correct: индекс правильного ответа в массиве options.
- explanation: объяснение правильного ответа.
- _isCorrect: приватное свойство, указывающее, был ли дан правильный ответ.

## Методы

### set isCorrect

Метод set isCorrect позволяет установить, был ли ответ пользователя правильным, исходя из переданного индекса выбранного варианта ответа.

typescript
set isCorrect(value: number) {
    // ...
}

### getQuestionAndOptionsHTML

Метод getQuestionAndOptionsHTML возвращает HTML-строку с вопросом и списком вариантов ответа.

typescript
getQuestionAndOptionsHTML() {
    // ...
}

### getIsCorrectAndExplanationHTML

Метод getIsCorrectAndExplanationHTML возвращает HTML-строку, указывающую на правильность ответа пользователя, и содержит пояснение вопроса.

typescript
getIsCorrectAndExplanationHTML() {
    // ...
}

## Примечания

- Класс Quiz использует внешний список вопросов listQuiz для выбора случайного вопроса.
- Все методы и свойства класса предназначены для работы с вопросами и ответами викторины, а также для предоставления пользователю обратной связи.