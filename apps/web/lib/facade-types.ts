export type DataResult<T> = { status: 'available'; data: T } | { status: 'unavailable'; message: string };

export const available = <T>(data: T): DataResult<T> => ({ status: 'available', data });
export const unavailable = (message: string): DataResult<never> => ({ status: 'unavailable', message });
