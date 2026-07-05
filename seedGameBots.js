// Einmaliges Seeding-Skript: legt pro Spiel ein paar Ranglisten-Einträge an,
// damit die Bestenlisten nicht leer wirken. Feste Doc-IDs → erneutes
// Ausführen überschreibt nur dieselben Einträge (idempotent).
// Ausführen: node seedGameBots.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Zufällig aussehende, aber feste IDs (damit das Skript idempotent bleibt)
const seedEntries = {
  snake: [
    ["kX3mR9pQvT2nW8sL5dF1", "Jonas_04", 21],
    ["aB7cN2wE9rY4tU1iP6oZ", "mia.k", 17],
    ["qW5eR8tZ3uI6oP1aS4dX", "Finnley", 14],
    ["mN9bV3cX7zL2kJ5hG8fQ", "lea_sf", 11],
    ["pO4iU7yT1rE5wQ9aZ3xV", "TobiGT", 9],
    ["hG2fD6sA9qW3eR7tZ1uY", "emmi", 6],
    ["cV8bN1mZ4xL7kJ3hG6fS", "Paul_H", 4],
  ],
  stack: [
    ["dF3gH7jK1lQ5wE9rT2yU", "Nele W", 34],
    ["sA6dF9gH2jK5lZ8xC1vB", "lukas99", 27],
    ["wE1rT4zU7iO0pA3sD6fG", "Jannik", 22],
    ["xC5vB8nM1qW4eR7tZ0uI", "sophie.b", 17],
    ["kJ9hG2fD5sA8qW1eR4tZ", "Maxi", 12],
    ["zU3iO6pA9sD2fG5hJ8kL", "hannah_lo", 8],
  ],
  flappy: [
    ["bN4mQ7wE0rT3zU6iO9pA", "Elias_07", 26],
    ["fG8hJ1kL4zX7cV0bN3mQ", "marie.s", 19],
    ["rT2zU5iO8pA1sD4fG7hJ", "Timo", 14],
    ["vB6nM9qW2eR5tZ8uI1oP", "lina_04", 9],
    ["jK0lZ3xC6vB9nM2qW5eR", "Felix B", 5],
    ["tZ4uI7oP0aS3dF6gH9jK", "amelie", 3],
  ],
  crossy: [
    ["gH5jK8lZ1xC4vB7nM0qW", "Leon_HD", 48],
    ["eR9tZ2uI5oP8aS1dF4gH", "clara.m", 39],
    ["nM3qW6eR9tZ2uI5oP8aS", "Bene", 31],
    ["lZ7xC0vB3nM6qW9eR2tZ", "johanna_w", 24],
    ["uI1oP4aS7dF0gH3jK6lZ", "Niklas04", 16],
    ["oP5aS8dF1gH4jK7lZ0xC", "frieda", 10],
  ],
  blockblast: [
    ["aS2dF5gH8jK1lZ4xC7vB", "Mats_09", 412],
    ["dF6gH9jK2lZ5xC8vB1nM", "leni.k", 337],
    ["gH0jK3lZ6xC9vB2nM5qW", "Joshi", 268],
    ["jK4lZ7xC0vB3nM6qW9eR", "annika_b", 195],
    ["lZ8xC1vB4nM7qW0eR3tZ", "Fabio HD", 121],
    ["xC2vB5nM8qW1eR4tZ7uI", "romy", 74],
  ],
  bubbles: [
    ["vB6nM9qW2eR5tZ8uI1oX", "Carlotta", 214],
    ["nM0qW3eR6tZ9uI2oP5aS", "til_04", 176],
    ["qW4eR7tZ0uI3oP6aS9dF", "Merle S", 141],
    ["eR8tZ1uI4oP7aS0dF3gH", "jannes", 102],
    ["tZ2uI5oP8aS1dF4gH7jX", "Ronja_W", 63],
    ["uI6oP9aS2dF5gH8jK1lX", "basti.m", 31],
  ],
};

// Zufälliger Zeitpunkt in den letzten 14 Tagen, damit die Einträge
// natürlich wirken
const randomRecentDate = () =>
  new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600 * 1000));

(async () => {
  const batch = db.batch();
  let count = 0;
  for (const [gameId, entries] of Object.entries(seedEntries)) {
    for (const [uid, name, score] of entries) {
      const ref = db
        .collection("leaderboards")
        .doc(gameId)
        .collection("entries")
        .doc(uid);
      batch.set(ref, {
        uid,
        name,
        score,
        updatedAt: admin.firestore.Timestamp.fromDate(randomRecentDate()),
      });
      count++;
    }
  }
  await batch.commit();
  console.log(`Fertig: ${count} Einträge geschrieben.`);
  process.exit(0);
})().catch((err) => {
  console.error("Seeding fehlgeschlagen:", err);
  process.exit(1);
});
