export class Logger {
    private static formatTime(): string {
        const now = new Date();
        return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    }

    static info(category: string, message: string, context?: any) {
        console.log(`[\x1b[36m${this.formatTime()}\x1b[0m] [\x1b[32mINFO\x1b[0m] [\x1b[35m${category}\x1b[0m] ${message}`, context ? context : '');
    }

    static warn(category: string, message: string, context?: any) {
        console.warn(`[\x1b[36m${this.formatTime()}\x1b[0m] [\x1b[33mWARN\x1b[0m] [\x1b[35m${category}\x1b[0m] ${message}`, context ? context : '');
    }

    static error(category: string, message: string, context?: any) {
        console.error(`[\x1b[36m${this.formatTime()}\x1b[0m] [\x1b[31mERROR\x1b[0m] [\x1b[35m${category}\x1b[0m] ${message}`, context ? context : '');
    }
}
