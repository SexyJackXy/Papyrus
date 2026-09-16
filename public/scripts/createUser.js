// scripts/createUser.js
//
// Admin-Skript zum Anlegen eines Benutzers. Ein Benutzername/Passwort kann
// mehreren Personen (Vorname + Nachname) zugeordnet werden.
//
// Nutzung:
//   node scripts/createUser.js <username> <passwort> "Vorname1 Nachname1" ["Vorname2 Nachname2" ...]
//
// Beispiel:
//   node scripts/createUser.js wa1 geheim123 "Max Mustermann" "Erika Musterfrau"

var bcrypt = require("bcrypt");
var { getUserByUsername, createUser, addNameToUser } = require("../db");

async function main() {
  var [username, password, ...nameArgs] = process.argv.slice(2);

  if (!username || !password || nameArgs.length === 0) {
    console.error(
      'Nutzung: node scripts/createUser.js <username> <passwort> "Vorname Nachname" [...weitere Namen]'
    );
    process.exit(1);
  }

  if (getUserByUsername(username)) {
    console.error(`Fehler: Benutzername "${username}" existiert bereits.`);
    process.exit(1);
  }

  var names = nameArgs.map((entry) => {
    var parts = entry.trim().split(/\s+/);
    if (parts.length < 2) {
      console.error(
        `Fehler: "${entry}" muss aus Vorname und Nachname bestehen (z. B. "Max Mustermann").`
      );
      process.exit(1);
    }
    var lastName = parts.pop();
    var firstName = parts.join(" ");
    return { firstName, lastName };
  });

  var passwordHash = await bcrypt.hash(password, 12);
  var userId = createUser(username, passwordHash);

  names.forEach(({ firstName, lastName }) => {
    addNameToUser(userId, firstName, lastName);
  });

  console.log(`Benutzer "${username}" wurde angelegt (ID ${userId}).`);
  console.log(
    "Zugeordnete Namen: " +
      names.map((n) => `${n.firstName} ${n.lastName}`).join(", ")
  );
}

main().catch((err) => {
  console.error("Fehler beim Anlegen des Benutzers:", err);
  process.exit(1);
});