const isPlainObject = (value: object): boolean => {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const compareSurfaceValues = (
    left: unknown,
    right: unknown,
    visitedPairs: WeakMap<object, WeakSet<object>>
): boolean => {
    if (Object.is(left, right)) return true;
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
        return false;
    }

    const visitedRightValues = visitedPairs.get(left);
    if (visitedRightValues?.has(right)) return true;
    if (visitedRightValues) {
        visitedRightValues.add(right);
    } else {
        visitedPairs.set(left, new WeakSet([right]));
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
        return left.every((value, index) => compareSurfaceValues(value, right[index], visitedPairs));
    }

    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Reflect.ownKeys(left);
    const rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every(key => (
        Object.prototype.hasOwnProperty.call(right, key)
        && compareSurfaceValues(Reflect.get(left, key), Reflect.get(right, key), visitedPairs)
    ));
};

/**
 * Surface input 只对普通对象和数组做值比较，函数与其他实例保持引用语义。
 */
export const isSurfaceValueEquivalent = (left: unknown, right: unknown): boolean =>
    compareSurfaceValues(left, right, new WeakMap());
