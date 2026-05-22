const unsupported = (name: string): never => {
    throw new Error(`node:zlib.${name} is not available in the browser shell runtime.`);
};

export const gunzipSync = (): never => unsupported('gunzipSync');
export const gzipSync = (): never => unsupported('gzipSync');
export const constants = {};

export default {
    constants,
    gunzipSync,
    gzipSync
};
