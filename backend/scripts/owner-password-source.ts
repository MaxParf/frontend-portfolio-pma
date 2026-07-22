import { execFileSync } from "node:child_process";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";

export interface PasswordSourceOptions {
  env?: { ADMIN_PASSWORD?: string };
  input?: NodeJS.ReadStream;
  promptPassword?: (prompt: string) => Promise<string>;
}

export interface HiddenPromptOptions {
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
  setEcho?: (enabled: boolean) => void;
  question?: (prompt: string) => Promise<string>;
}

function setTerminalEcho(enabled: boolean): void {
  execFileSync("stty", [enabled ? "echo" : "-echo"], { stdio: ["inherit", "ignore", "ignore"] });
}

function readHiddenLine(prompt: string, input: NodeJS.ReadStream, output: NodeJS.WriteStream): Promise<string> {
  output.write(prompt);
  const wasPaused = input.isPaused();
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup(): void {
      input.off("data", onData);
      if (wasPaused) {
        input.pause();
      }
    }

    function finish(result: string): void {
      cleanup();
      resolve(result);
    }

    function fail(error: Error): void {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer | string): void {
      const text = chunk.toString("utf8");
      for (const character of text) {
        if (character === "\u0003") {
          fail(new Error("Aborted with Ctrl+C"));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") {
          value += character;
        }
      }
    }

    input.on("data", onData);
  });
}

export async function promptHiddenPassword(prompt: string, options: HiddenPromptOptions = {}): Promise<string> {
  const input = options.input ?? defaultInput;
  const output = options.output ?? defaultOutput;
  const setEcho = options.setEcho ?? setTerminalEcho;
  const question = options.question ?? ((promptText: string) => readHiddenLine(promptText, input, output));
  const wasRaw = input.isRaw;

  if (!input.isTTY) {
    throw new Error("ADMIN_PASSWORD is required when owner bootstrap runs without an interactive TTY.");
  }

  try {
    input.setRawMode?.(true);
    setEcho(false);
    return await question(prompt);
  } finally {
    try {
      setEcho(true);
      if (typeof wasRaw === "boolean") {
        input.setRawMode?.(wasRaw);
      } else {
        input.setRawMode?.(false);
      }
    } finally {
      output.write("\n");
    }
  }
}

export async function resolveOwnerPassword(options: PasswordSourceOptions = {}): Promise<string> {
  const env = options.env ?? process.env;
  const input = options.input ?? defaultInput;
  const promptPassword = options.promptPassword ?? ((prompt: string) => promptHiddenPassword(prompt, { input }));

  if (Object.prototype.hasOwnProperty.call(env, "ADMIN_PASSWORD")) {
    const password = env.ADMIN_PASSWORD;
    if (!password) {
      throw new Error("ADMIN_PASSWORD is empty. Provide a non-empty value or unset it to use the hidden interactive prompt.");
    }
    return password;
  }

  if (!input.isTTY) {
    throw new Error("ADMIN_PASSWORD is required when owner bootstrap runs without an interactive TTY.");
  }

  const password = await promptPassword("Owner password: ");
  const confirmation = await promptPassword("Confirm owner password: ");

  if (password !== confirmation) {
    throw new Error("Owner password confirmation does not match.");
  }

  return password;
}

export function assertNoPasswordCliArgument(argv: string[]): void {
  const passwordArgument = argv.find((argument) => /^--?password(?:=|$)/i.test(argument) || /^--?admin-password(?:=|$)/i.test(argument));

  if (passwordArgument) {
    throw new Error("Owner password must not be passed as a command-line argument. Use ADMIN_PASSWORD or the hidden interactive prompt.");
  }
}
