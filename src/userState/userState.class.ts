import fs from 'node:fs/promises';
import path from 'node:path';
import { IUserState } from './userState.interface';

export class UserState {
    private stateDirPath: string = path.join('state');

    constructor() {
        this.initStateDir();
    }

    private async initStateDir(): Promise<void> {
        try {
            await fs.access(this.stateDirPath);
        } catch {
            await fs.mkdir(this.stateDirPath, { recursive: true });
        }
    }

    private async getUserFilePath(userId: number): Promise<string> {
        return path.join(this.stateDirPath, `${userId}.json`);
    }

    private async ensureFileExists(filePath: string): Promise<void> {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify({ countQuiz: 0, correctAnswer: 0 }), 'utf8');
        }
    }

    public async getUserState(userId: number): Promise<IUserState> {
        const filePath: string = await this.getUserFilePath(userId);
        await this.ensureFileExists(filePath);
        const data: string = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    }

    private async saveUserState(userId: number, userState: IUserState): Promise<void> {
        const filePath: string = await this.getUserFilePath(userId);
        const data: string = JSON.stringify(userState, null, 2);
        await fs.writeFile(filePath, data, 'utf8');
    }

    public async incrementQuizCount(userId: number): Promise<void> {
        const userState: IUserState = await this.getUserState(userId);
        userState.countQuiz += 1;
        await this.saveUserState(userId, userState);
    }

    public async incrementCorrectAnswer(userId: number): Promise<void> {
        const userState: IUserState = await this.getUserState(userId);
        userState.correctAnswer += 1;
        await this.saveUserState(userId, userState);
    }
}
