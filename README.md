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


## Branch
- git branch develop
- git checkout develop 
- git branch feature/first-version
- git checkout feature/first-version 

## Структура проекта

- bot - [команды для использования в приложении](./src/bot.md)
- commands - [команды для использования в приложении](./src/commands.md)
- constants - константы используемые в коде
- keyboards - клавиатуры используемые в коде
- state-users - [управление состоянием пользователей](./src/state-users.md)
- quiz-class - [класс викторины с вопросами по JavaScript](./src/quiz.md)

## Если ООП, то структура проекта:

1. BotController - класс для управления основными командами бота.
2. MessageHandler - класс для обработки входящих сообщений и команд.
3. Command - базовый класс или интерфейс для команд, от которого наследуются все конкретные команды.
4. SessionManager - класс для управления сессиями пользователей.
5. state-user - представление пользователей и его данных.
6. DatabaseAdapter - класс для абстрагирования работы с базой данных.
7. Service - классы для бизнес-логики, не связанной напрямую с телеграм-ботом.