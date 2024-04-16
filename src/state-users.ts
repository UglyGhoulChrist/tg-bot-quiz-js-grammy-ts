import fs from 'node:fs';
import path from 'node:path';
import { IStateUsers } from './state-users.interface';

const ENCODING = 'utf8';

// Проверяю наличие файла и создаю его, если он отсутствует
function ensureFileExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, '{}', ENCODING);
    }
}

// Загружаю состояние из файла
export function loadState(): IStateUsers {
    // Получаю путь к файлу состояний из .env
    const filePath = path.join(process.env.STATE_PATH as string, process.env.STATE_FILE as string)
    // Убеждаюсь, что файл существует
    ensureFileExists(filePath);
    try {
        const data: string = fs.readFileSync(filePath, ENCODING);
        const stateUsers: IStateUsers = JSON.parse(data)
        return stateUsers;
    } catch (error) {
        // Типизирую error как NodeJS.ErrnoException
        const err: NodeJS.ErrnoException = error as NodeJS.ErrnoException;
        console.log('Не удалось прочитать состояния пользователей', err.message);
        // Если возникла ошибка, сообщаю об этом и возвращаю пустой объект
        return {};
    }
}

// Сохраняю состояние в файл
export function saveState(state: IStateUsers): void {
    // Получаю путь к файлу состояний из .env
    const filePath = path.join(process.env.STATE_PATH as string, process.env.STATE_FILE as string)
    // Убеждаюсь, что файл существует
    ensureFileExists(filePath);
    try {
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2), ENCODING);
    } catch (error) {
        // Если возникла ошибка при сохранении, сообщаю об этом
        // Типизирую error как NodeJS.ErrnoException
        const err: NodeJS.ErrnoException = error as NodeJS.ErrnoException;
        console.log('Не удалось сохранить состояния пользователей', err.message);
    }
}
