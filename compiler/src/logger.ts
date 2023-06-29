import { blue, bold, underline, gray } from "colorette";

export type Logger = {
  (...args: any): void;
  prefix: string;
  withIndent: (indent: number) => Logger;
  withTransform: (transform: LogItemTransformer) => Logger;
  withIf: (condition: () => boolean) => Logger;
  on: () => void;
  off: () => void;
};

// type DebugLoggerInitializer = string;
type LogItemTransformer = (item: any, idx?: number, array?: any) => any;
export function createLogger(
  initializer: string | number,
  initialDebug: boolean | (() => boolean) = false,
  ...transforms: LogItemTransformer[]
) {
  let prefix = typeof initializer === "string" ? initializer : "  ".repeat(initializer);
  const transform: LogItemTransformer | undefined =
    transforms.length > 0
      ? transforms.reduce(
          (prev, curr) => (item, idx) => curr(prev(item, idx), idx),
          (item: any) => item,
        )
      : undefined;
  return createLoggerInternal(prefix, initialDebug, transform);

  function createLoggerInternal(
    prefix: string,
    debugOrFunc: boolean | (() => boolean),
    transform?: LogItemTransformer,
  ): Logger {
    let debug = typeof debugOrFunc === "function" ? debugOrFunc() : debugOrFunc;
    const log: Logger = (...args: any[]) => {
      if (!debugOrFunc) return;
      const mapped = transform ? args.map(transform) : args;
      const header = bold(gray(prefix));
      if (typeof debugOrFunc === "function") {
        debug = debugOrFunc();
        if (!debug) return;
      }
      console.log(
        header,
        ...mapped
          .map((item, idx) => {
            // const first = `{${idx}}`;
            if (typeof item === "string") {
              if (item.includes("\n")) {
                // const leading = idx === 0 ? `${header}:${gray(idx)}` : `\n${header}:${gray(idx)}`
                return `\n------\n${item}\n------`;
              }
              return item;
            } else {
              return item;
              // const leading = idx === 0 ? `${header}:${gray(idx)}` : `\n${header}:${gray(idx)}`
              // return [`\n${leading}`, item];
            }
          })
          .flat(1),
      );
    };
    log.withIf = (conditionFunc: () => boolean) => {
      return createLoggerInternal(prefix, conditionFunc, transform);
    };
    log.withTransform = (...transforms: LogItemTransformer[]) => {
      const composed =
        transforms.length > 0
          ? transforms.reduce(
              (prev, curr) => (item, idx) => curr(prev(item, idx), idx),
              (item: any) => item,
            )
          : undefined;
      return createLoggerInternal(prefix, debugOrFunc, composed);
    };
    log.withIndent = (indent: number) => {
      const newPrefix = "  ".repeat(indent) + prefix;
      return createLoggerInternal(newPrefix, debugOrFunc);
    };
    log.on = () => (debugOrFunc = true);
    log.off = () => (debugOrFunc = false);
    log.prefix = prefix;
    return log;
  }
}
