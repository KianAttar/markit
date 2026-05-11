import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.stdout.isTTY
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  });
}
