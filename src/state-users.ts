import fs from 'node:fs/promises';
import path from 'node:path';
import { IStateUsers } from './state-users.interface';

const ENCODING = 'utf8';

// Получаю путь к файлу состояний
function getStateFilePath(): string {
    const statePath: string = process.env.STATE_PATH || 'path_to_default_state_dir';
    const stateFile: string = process.env.STATE_FILE || 'default-state-users.json';
    return path.join(statePath, stateFile);
}

// Проверяю наличие файла и создаю его, если он отсутствует
async function ensureFileExists(filePath: string): Promise<void> {
    try {
        await fs.access(filePath);
    } catch {
        const dir: string = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, '{}', ENCODING);
    }
}

// Загружаю состояние из файла
export async function loadState(): Promise<IStateUsers> {
    const filePath: string = getStateFilePath();
    await ensureFileExists(filePath);
    try {
        const data: string = await fs.readFile(filePath, ENCODING);
        return JSON.parse(data);
    } catch (error) {
        // Типизирую error как NodeJS.ErrnoException
        const err: NodeJS.ErrnoException = error as NodeJS.ErrnoException;
        console.log('Не удалось прочитать состояния пользователей', err.message);
        // Если возникла ошибка, сообщаю об этом и возвращаю пустой объект
        return {};
    }
}

// Сохраняю состояние в файл
export async function saveState(state: IStateUsers): Promise<void> {
    const filePath: string = getStateFilePath();
    await ensureFileExists(filePath);
    try {
        await fs.writeFile(filePath, JSON.stringify(state, null, 2), ENCODING);
    } catch (error) {
        // Если возникла ошибка при сохранении, сообщаю об этом
        // Типизирую error как NodeJS.ErrnoException
        const err: NodeJS.ErrnoException = error as NodeJS.ErrnoException;
        console.log('Не удалось сохранить состояния пользователей', err.message);
    }
}
