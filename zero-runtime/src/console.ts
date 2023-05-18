export type console$logT = <T extends any[]>(...args: T) => void;
export type console$warnT = <T extends any[]>(...args: T) => void;
export type console$errorT = <T extends any[]>(...args: T) => void;
export type console$infoT = <T extends any[]>(...args: T) => void;

export const console$logT = console.log as console$logT;
export const console$infoT = console.info as console$infoT;
export const console$warnT = console.warn as console$warnT;
export const console$errorT = console.error as console$errorT;
// export const cosole$ = console.assert(condition?: boolean, ...data: any[]) => void;
// export const cosole$ = console.clear(): void;
// export const cosole$ = console.count(label?: string): void;
// export const cosole$ = console.countReset(label?: string): void;
// export const cosole$ = console.debug(...data: any[]): void;
// export const cosole$ = console.dir(item?: any, options?: any): void;
// export const cosole$ = console.dirxml(...data: any[]): void;
// export const cosole$ = console.error(...data: any[]): void;
// export const cosole$ = console.group(...data: any[]): void;
// export const cosole$ = console.groupCollapsed(...data: any[]): void;
// export const cosole$ = console.groupEnd(): void;
// export const cosole$ = console.info(...data: any[]): void;
// export const cosole$ = console.log(...data: any[]): void;
// export const cosole$ = console.table(tabularData?: any, properties?: string[]): void;
// export const cosole$ = console.time(label?: string): void;
// export const cosole$ = console.timeEnd(label?: string): void;
// export const cosole$ = console.timeLog(label?: string, ...data: any[]): void;
// export const cosole$ = console.timeStamp(label?: string): void;
// export const cosole$ = console.trace(...data: any[]): void;
// export const cosole$ = console.warn(...data: any[]): void;
