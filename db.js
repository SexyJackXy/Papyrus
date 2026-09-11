// db.js
// Zentrale SQLite-Anbindung für Benutzer + zugehörige Vor-/Nachnamen.
// Ein Benutzername/Passwort kann mehreren Personen (Vor- & Nachname) zugeordnet sein.

var path = require("path");
var Database = require("better-sqlite3");

var DB_PATH = path.join(__dirname, "app.db");
var db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_names (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function getNamesForUser(userId) {
  return db
    .prepare("SELECT first_name, last_name FROM user_names WHERE user_id = ?")
    .all(userId);
}

function createUser(username, passwordHash) {
  var info = db
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);
  return info.lastInsertRowid;
}

function addNameToUser(userId, firstName, lastName) {
  db.prepare(
    "INSERT INTO user_names (user_id, first_name, last_name) VALUES (?, ?, ?)"
  ).run(userId, firstName, lastName);
}

module.exports = {
  db,
  getUserByUsername,
  getUserById,
  getNamesForUser,
  createUser,
  addNameToUser,
};