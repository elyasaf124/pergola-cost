/**
 * Which store the app uses
 * ---------------------------
 * Firestore is selected only when Firebase env vars are present AND the user
 * is signed in with Google. Every cloud document is stored under
 * `users/{uid}/...`, and Firestore offline persistence is enabled in
 * `src/lib/firebase.ts`.
 *
 * In every other case — missing keys, signed out, or Firebase not set up yet —
 * the app uses the local IndexedDB repository and stays fully usable.
 * JSON export/import uses the same backup shape in both modes.
 */
export { createLocalRepository } from "@/data/local-repository"
export { createFirestoreRepository } from "@/data/firestore-repository"
export type { Repository } from "@/data/repository"
