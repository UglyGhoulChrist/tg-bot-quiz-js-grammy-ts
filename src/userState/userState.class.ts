import fs from 'node:fs/promises';
import path from 'node:path';
import { IUserState } from './userState.interface';

// Создаю класс для управления состоянием пользователя.
export class UserState {
    // Путь к директории, где будут храниться файлы состояния.
    private stateDirPath: string = path.join('state');

    constructor() {
        // При создании экземпляра класса сразу же инициализирую директорию для хранения состояний.
        this.initStateDir();
    }

    // Метод для инициализации директории состояний.
    private async initStateDir(): Promise<void> {
        try {
            // Проверяю, существует ли директория.
            await fs.access(this.stateDirPath);
        } catch {
            // Если нет, создаю её, включая все необходимые родительские директории.
            await fs.mkdir(this.stateDirPath, { recursive: true });
        }
    }

    // Метод для получения пути к файлу состояния конкретного пользователя.
    private async getUserFilePath(userId: number): Promise<string> {
        // Использую ID пользователя для создания уникального имени файла.
        return path.join(this.stateDirPath, `${userId}.json`);
    }

    // Метод для проверки существования файла состояния пользователя.
    private async ensureFileExists(filePath: string): Promise<void> {
        try {
            // Проверяю, доступен ли файл.
            await fs.access(filePath);
        } catch {
            // Если нет, создаю файл с начальным состоянием.
            await fs.writeFile(filePath, JSON.stringify({ countQuiz: 0, correctAnswer: 0 }), 'utf8');
        }
    }

    // Метод для получения состояния пользователя.
    public async getUserState(userId: number): Promise<IUserState> {
        const filePath: string = await this.getUserFilePath(userId);
        // Убеждаюсь, что файл существует.
        await this.ensureFileExists(filePath);
        // Читаю данные из файла.
        const data: string = await fs.readFile(filePath, 'utf8');
        // Возвращаю данные в виде объекта состояния.
        return JSON.parse(data);
    }

    // Метод для сохранения состояния пользователя.
    private async saveUserState(userId: number, userState: IUserState): Promise<void> {
        const filePath: string = await this.getUserFilePath(userId);
        // Преобразую объект состояния в строку JSON.
        const data: string = JSON.stringify(userState, null, 2);
        // Сохраняю строку JSON в файл.
        await fs.writeFile(filePath, data, 'utf8');
    }

    // Метод для увеличения количества пройденных викторин пользователем.
    public async incrementQuizCount(userId: number): Promise<void> {
        // Получаю текущее состояние пользователя.
        const userState: IUserState = await this.getUserState(userId);
        // Увеличиваю счётчик пройденных викторин.
        userState.countQuiz += 1;
        // Сохраняю обновлённое состояние.
        await this.saveUserState(userId, userState);
    }

    // Метод для увеличения количества правильных ответов пользователя.
    public async incrementCorrectAnswer(userId: number): Promise<void> {
        // Получаю текущее состояние пользователя.
        const userState: IUserState = await this.getUserState(userId);
        // Увеличиваю счётчик правильных ответов.
        userState.correctAnswer += 1;
        // Сохраняю обновлённое состояние.
        await this.saveUserState(userId, userState);
    }
}
