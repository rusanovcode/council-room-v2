const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function now() {
  return new Date().toISOString();
}

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "topic"
  );
}

function safeId(value) {
  const id = String(value || "");
  if (!id || path.basename(id) !== id) throw new Error("Invalid id");
  return id;
}

function readJson(file, fallback = null) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function readText(file, fallback = "") {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : fallback;
  } catch {
    return fallback;
  }
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function appendJsonl(file, item) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(item)}\n`, "utf8");
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function rewriteJsonl(file, items) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = items.map((item) => JSON.stringify(item)).join("\n");
  fs.writeFileSync(file, text ? `${text}\n` : "", "utf8");
}

function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function makeRunId(topic) {
  return `${now().replace(/[:.]/g, "-")}--${slugify(topic)}`;
}

module.exports = {
  now,
  slugify,
  safeId,
  readJson,
  writeJson,
  readText,
  writeText,
  appendJsonl,
  readJsonl,
  rewriteJsonl,
  makeId,
  makeRunId,
};
