import fs from 'node:fs/promises';
import path from 'node:path';
import { IUserState } from './userState.interface';

export class UserState {

    private state: Record<number, { countQuiz: number; correctAnswer: number }> = {};
    private stateFilePath: string = path.join('dist', 'state-users.json');

    constructor() {
        this.initState();
    }

    private async initState(): Promise<void> {
        await this.ensureFileExists();
        await this.loadState();
    }

    private async ensureFileExists(): Promise<void> {
        try {
            await fs.access(this.stateFilePath);
        } catch {
            const dir: string = path.dirname(this.stateFilePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.stateFilePath, '{}', 'utf8');
        }
    }

    private async loadState(): Promise<void> {
        try {
            const data: string = await fs.readFile(this.stateFilePath, 'utf8');
            this.state = JSON.parse(data);
        } catch (error) {
            this.state = {};
        }
    }

    private async saveState(): Promise<void> {
        const data: string = JSON.stringify(this.state, null, 2);
        await fs.writeFile(this.stateFilePath, data, 'utf8');
    }

    public async getUserState(userId: number): Promise<IUserState> {
        return this.state[userId] || { countQuiz: 0, correctAnswer: 0 };
    }

    private async checkOrCreateUserState(userId: number): Promise<void> {
        if (!this.state[userId]) {
            this.state[userId] = { countQuiz: 0, correctAnswer: 0 };
        }
    }

    public async incrementQuizCount(userId: number): Promise<void> {
        await this.checkOrCreateUserState(userId);
        this.state[userId].countQuiz += 1;
        await this.saveState();
    }

    public async incrementCorrectAnswer(userId: number): Promise<void> {
        await this.checkOrCreateUserState(userId);
        this.state[userId].correctAnswer += 1;
        await this.saveState();
    }
}
