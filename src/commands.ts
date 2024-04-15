import { ICommand } from "./commands.interface";

// Основные команды: `/help`, `/start`, `/question`
export const commands: ICommand[] = [
    { command: 'help', description: 'Помощь' },
    { command: 'start', description: 'Приветствие' },
    { command: 'question', description: 'Получить вопрос' },
]