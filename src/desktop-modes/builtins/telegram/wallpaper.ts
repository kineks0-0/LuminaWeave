/**
 * Telegram 风格的聊天壁纸：自绘线描涂鸦平铺图（非原版素材），只描边、不填充。
 * 颜色由皮肤按明暗传入，返回可直接用于 background 的 url()。
 */

export const TELEGRAM_WALLPAPER_TILE_PX = 320;

const DOODLES = [
    // 星星
    '<path d="M42 18l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>',
    // 心
    '<path d="M150 46c-12-8-18-15-14-22 3-5 11-5 14 1 3-6 11-6 14-1 4 7-2 14-14 22z"/>',
    // 纸飞机
    '<path d="M236 40l44-18-14 42-11-15zM255 49l25-27"/>',
    // 月亮
    '<path d="M86 96a18 18 0 1 0 6 30 14 14 0 1 1-6-30z"/>',
    // 音符
    '<path d="M186 128V98l24-6v28"/><ellipse cx="180" cy="129" rx="7" ry="5.5"/><ellipse cx="204" cy="121" rx="7" ry="5.5"/>',
    // 云
    '<path d="M250 150a10 10 0 0 1 3-19 14 14 0 0 1 26-3 10 10 0 0 1 6 22z"/>',
    // 叶子
    '<path d="M18 222c0-26 22-37 40-35 0 20-14 37-40 35zM18 222l26-24"/>',
    // 螺旋
    '<path d="M132 196a4 4 0 1 1 8 0 8 8 0 1 1-16 0 12 12 0 1 1 24 0 16 16 0 1 1-32 0"/>',
    // 闪电
    '<path d="M230 186l-14 26h13l-7 22 22-32h-13l8-16z"/>',
    // 猫
    '<path d="M48 276l3-17 10 10M84 276l-3-17-10 10"/><circle cx="66" cy="284" r="18"/><circle cx="59" cy="282" r="1.6"/><circle cx="73" cy="282" r="1.6"/><path d="M62 290q4 3 8 0"/>',
    // 杯子
    '<path d="M150 262h28v18a9 9 0 0 1-9 9h-10a9 9 0 0 1-9-9zM178 267h5a6 6 0 0 1 0 12h-5M158 254c0-5 5-5 5-10M168 254c0-5 5-5 5-10"/>',
    // 礼物
    '<path d="M250 262h40v32h-40zM246 252h48v10h-48zM270 252v42M270 252c-6-12-18-10-14-2 2 3 8 3 14 2 6 1 12 1 14-2 4-8-8-10-14 2"/>',
    // 气球
    '<path d="M302 98c0-10-7-17-15-17s-15 7-15 17 9 18 15 20c6-2 15-10 15-20zM287 118l-3 6h6l-3-6c0 10-6 12-2 20"/>',
    // 花
    '<circle cx="104" cy="168" r="4"/><circle cx="104" cy="158" r="5"/><circle cx="113" cy="166" r="5"/><circle cx="109" cy="176" r="5"/><circle cx="98" cy="176" r="5"/><circle cx="95" cy="166" r="5"/>',
    // 散点
    '<circle cx="110" cy="100" r="2.5"/><circle cx="214" cy="250" r="2.5"/><circle cx="20" cy="140" r="2.5"/><circle cx="300" cy="200" r="2.5"/><circle cx="190" cy="20" r="2.5"/><circle cx="120" cy="300" r="2.5"/>'
];

export const createTelegramWallpaper = (strokeColor: string): string => {
    const size = TELEGRAM_WALLPAPER_TILE_PX;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DOODLES.join('')}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
