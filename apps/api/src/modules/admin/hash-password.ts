import { randomBytes, scryptSync } from "node:crypto";

if (!process.stdin.isTTY) {
  throw new Error("Run this command in a terminal to enter the password securely.");
}

function readPassword() {
  const input = process.stdin;
  input.setRawMode(true);
  input.resume();
  process.stdout.write("Admin password: ");

  return new Promise<string>((resolve, reject) => {
    let password = "";
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          reject(new Error("Password hashing cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(password);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
          continue;
        }
        password += character;
      }
    };

    input.on("data", onData);
  });
}

const password = await readPassword();
if (password.length < 12 || password.length > 200) {
  throw new Error("Use an admin password between 12 and 200 characters.");
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`${salt.toString("hex")}$${hash}`);
