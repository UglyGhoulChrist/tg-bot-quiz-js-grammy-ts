# Описание интерфейса команд

Этот документ описывает интерфейс ICommand и массив доступных команд для использования в приложении.

## ICommand

Интерфейс ICommand определяет структуру команды в приложении.

typescript
export interface ICommand {
    command: string;     // Команда, которую пользователь может ввести
    description: string; // Описание команды
}

## Команды

Ниже приведен список основных команд, которые могут быть использованы в приложении:

- /help - команда для получения помощи по использованию приложения.
- /start - команда для начала взаимодействия с приложением или перезапуска сеанса.
- /question - команда для получения нового вопроса в викторине.
- /progress - команда для отображения текущего прогресса пользователя в викторине.

Пример массива команд:

typescript
import { ICommand } from "./commands.interface";

export const commands: ICommand = [
    { command: 'help', description: 'Помощь' },
    { command: 'start', description: 'Приветствие' },
    { command: 'question', description: 'Получить вопрос' },
    { command: 'progress', description: 'Прогресс викторины' }
]

Каждая команда в массиве соответствует интерфейсу ICommand и содержит два поля: command и description.