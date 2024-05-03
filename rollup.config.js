import typescript from '@rollup/plugin-typescript'

export default {
    input: 'src/bot.ts', // ваша точка входа
    output: {
        // dir: 'dist', // папка для вывода бандла
        file: 'dist/bundle.js',
        format: 'es', // формат модуля (cjs для Node.js)
    },
    plugins: [
        typescript(), // плагин для работы с TypeScript
    ],
    external: ['dotenv', 'grammy', 'node:fs/promises', 'node:path'],
    watch: {
        exclude: ['*.json', 'dist/**']
    }
}