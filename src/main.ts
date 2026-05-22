import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { boot } from './bootstrap/boot.js';
import './style.css';

async function startApp() {
    console.log('[Main] Starting application...');

    // 1. 先完成 HAL / runtime ports / storage 引导，避免业务面板早于 HAL 初始化挂载。
    await boot();

    // 2. 挂载应用；后续 LuminaWeaveAPI.init() 继续处理业务初始化和启动页进度。
    const app = createApp(App);
    app.use(createPinia());
    app.mount('#app');

    console.log('[Main] Boot complete. UI mounted.');
}

startApp().catch(err => {
    console.error('[Main] Critical startup error:', err);
});
