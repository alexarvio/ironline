// Creates (or resets) the coach account. Run once against a fresh deployment:
//
//   npx tsx scripts/create-coach.ts finlay@example.com 'a-good-password'
//
// Safe to re-run — if the email already exists it resets that account's
// password rather than erroring, which doubles as the "I'm locked out"
// recovery path since there's no password-reset email flow yet.
import { createUser, findUserByEmail, setPassword } from "../app/lib/auth";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("usage: npx tsx scripts/create-coach.ts <email> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("password must be at least 8 characters");
  process.exit(1);
}

const existing = findUserByEmail(email);
if (existing) {
  setPassword(existing.id, password, false);
  console.log(`Reset the password for existing ${existing.role} account ${email}`);
} else {
  createUser(email, password, "coach", null, false);
  console.log(`Created coach account ${email}`);
}
