# Telegram Bot Quiz JavaScript ( GrammyJS + TS )

Бот задает вопросы по JavaScript. Для каждого вопроса доступно четыре варианта ответа, один из которых является верным. После выбора ответа бот предоставит объяснение к вопросу и сообщит, правильно ли был выбран ответ.

## Created of the project
- mkdir tg-bot-quiz-js-grammy-ts
- cd tg-bot-quiz-js-grammy-ts
- code .
- yarn init -y
- tsc --init
- git init

- yarn add grammy
- yarn add dotenv
- yarn add -D @types/dotenv
- yarn add -D typescript
- yarn add -D tsc-watch
- yarn add -D @types/node

## branch feature/rollup
- yarn add -D rollup 
- yarn add -D @rollup/plugin-typescript
- yarn add -D nodemon
- yarn add -D concurrently
- yarn add tslib
- yarn add -D rollup-plugin-terser

## Branch and Tag
- develop
- feature/first-version
- feature/rollup 
- v1.0.0
- hotfix/session
- v1.0.1
- hotfix/refactoring
- v1.0.2

## Структура проекта

- bot.ts
- constants.ts - константы используемые в коде
- keyboards.ts - клавиатуры используемые в коде
- userState - состояние пользователей
    - getUserId.ts - функция проверки идентификации пользователя
    - userState.class.ts - класс для управления состоянием пользователя
    - userState.interface.ts - интерфейс для хранения состояния викторины конкретного пользователя
- session - временное хранение игрового процесса
    - initial.ts - функция инициализации начального состояния сессии каждого пользователя
    - sessionData.interface.ts - интерфейс для данных сессии
- quiz - викторина
    - startGame.ts - старт викторины
    - quiz.interface.ts - интерфейс для объекта викторины
    - quiz.class.ts - класс викторины
    - list-quiz.ts - массив с викторинами
- handlers - обработчики
    - handleHelpCommand - обработчик команды help
    - handleStartCommand - обработчик команды start
    - handleAnswerButtonClick - обработчик выбора варианта ответа
    - handleProgressCommand - обработчик команды progress
    - handleBotError - глобальный обработчик ошибок
- commands - команды
    - commands.interface.ts - интерфейс для команд
    - commands.ts - список команд
