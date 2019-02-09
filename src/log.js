// @flow

export const fatal = (...args: any[]) => console.error('[FATAL ERROR]', ...args)
export const err = (...args: any[]) => console.error('[ERROR]', ...args)
export const warn = (...args: any[]) => console.error('[WARN]', ...args)
