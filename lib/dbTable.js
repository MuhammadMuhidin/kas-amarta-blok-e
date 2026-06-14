export function isDevelopmentEnv() {
  return process.env.APP_ENV === "development";
}

export function dbTable(name) {
  return isDevelopmentEnv() ? `${name}_dev` : name;
}
