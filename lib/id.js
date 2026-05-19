export function generateId(prefix = "") {
  const time = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return prefix + time + rand;
}
