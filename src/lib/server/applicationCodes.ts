const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length: number) {
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    result += CODE_ALPHABET[index];
  }

  return result;
}

export function generateVerificationCode() {
  return `FRDA-${randomChars(6)}`;
}

export function generateTrackerToken() {
  return `${randomChars(8)}${randomChars(8)}${randomChars(8)}`;
}