import test from "node:test";
import assert from "node:assert/strict";
import { assertNoPasswordCliArgument, promptHiddenPassword, resolveOwnerPassword } from "../scripts/owner-password-source.js";

function fakeInput(isTTY: boolean, rawCalls: boolean[] = []): NodeJS.ReadStream {
  return { isTTY, isRaw: false, setRawMode: (enabled: boolean) => rawCalls.push(enabled) } as unknown as NodeJS.ReadStream;
}

function fakeOutput(writes: string[] = []): NodeJS.WriteStream {
  return { write: (chunk: string) => writes.push(chunk) } as unknown as NodeJS.WriteStream;
}

test("valid ADMIN_PASSWORD is used without calling prompt", async () => {
  let promptCalled = false;
  const password = await resolveOwnerPassword({
    env: { ADMIN_PASSWORD: "ValidOwnerPassword123" },
    input: fakeInput(true),
    promptPassword: async () => {
      promptCalled = true;
      return "PromptPassword123";
    },
  });

  assert.equal(password, "ValidOwnerPassword123");
  assert.equal(promptCalled, false);
});

test("empty ADMIN_PASSWORD fails safely and does not call prompt", async () => {
  let promptCalled = false;
  await assert.rejects(
    resolveOwnerPassword({
      env: { ADMIN_PASSWORD: "" },
      input: fakeInput(true),
      promptPassword: async () => {
        promptCalled = true;
        return "PromptPassword123";
      },
    }),
    /ADMIN_PASSWORD is empty/,
  );
  assert.equal(promptCalled, false);
});

test("no env plus non-TTY fails without reading stdin", async () => {
  await assert.rejects(resolveOwnerPassword({ env: {}, input: fakeInput(false) }), /ADMIN_PASSWORD is required/);
});

test("no env plus TTY uses hidden prompt and accepts matching values", async () => {
  const prompts: string[] = [];
  const password = await resolveOwnerPassword({
    env: {},
    input: fakeInput(true),
    promptPassword: async (prompt) => {
      prompts.push(prompt);
      return "MatchingPassword123";
    },
  });

  assert.equal(password, "MatchingPassword123");
  assert.deepEqual(prompts, ["Owner password: ", "Confirm owner password: "]);
});

test("prompt mismatch is rejected", async () => {
  const responses = ["FirstPassword123", "SecondPassword123"];
  await assert.rejects(
    resolveOwnerPassword({
      env: {},
      input: fakeInput(true),
      promptPassword: async () => responses.shift() ?? "",
    }),
    /confirmation does not match/,
  );
});

test("hidden prompt restores echo and writes newline when question succeeds", async () => {
  const echoCalls: boolean[] = [];
  const rawCalls: boolean[] = [];
  const writes: string[] = [];
  const password = await promptHiddenPassword("Owner password: ", {
    input: fakeInput(true, rawCalls),
    output: fakeOutput(writes),
    setEcho: (enabled) => echoCalls.push(enabled),
    question: async () => "HiddenPassword123",
  });

  assert.equal(password, "HiddenPassword123");
  assert.deepEqual(rawCalls, [true, false]);
  assert.deepEqual(echoCalls, [false, true]);
  assert.deepEqual(writes, ["\n"]);
});

test("hidden prompt restores echo and writes newline when question throws", async () => {
  const echoCalls: boolean[] = [];
  const rawCalls: boolean[] = [];
  const writes: string[] = [];
  await assert.rejects(
    promptHiddenPassword("Owner password: ", {
      input: fakeInput(true, rawCalls),
      output: fakeOutput(writes),
      setEcho: (enabled) => echoCalls.push(enabled),
      question: async () => {
        throw new Error("interrupted");
      },
    }),
    /interrupted/,
  );

  assert.deepEqual(rawCalls, [true, false]);
  assert.deepEqual(echoCalls, [false, true]);
  assert.deepEqual(writes, ["\n"]);
});

test("password command-line arguments are rejected", () => {
  assert.throws(() => assertNoPasswordCliArgument(["--password=SecretPassword123"]), /must not be passed/);
  assert.throws(() => assertNoPasswordCliArgument(["--admin-password", "SecretPassword123"]), /must not be passed/);
  assert.doesNotThrow(() => assertNoPasswordCliArgument(["@maxpar.fed", "Maksim"]));
});
