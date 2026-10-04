import { initializeApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from "firebase/auth"
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore"

function readEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    readEnv(import.meta.env.VITE_FIREBASE_API_KEY) &&
      readEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
      readEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
      readEnv(import.meta.env.VITE_FIREBASE_APP_ID),
  )
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getFirebaseAuth(): Auth {
  return getFirebase().auth
}

export function getFirestoreDb(): Firestore {
  return getFirebase().db
}

function getFirebase(): { auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured")
  }
  if (!app || !auth || !db) {
    app = initializeApp({
      apiKey: readEnv(import.meta.env.VITE_FIREBASE_API_KEY),
      authDomain: readEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
      projectId: readEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
      storageBucket: readEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
      messagingSenderId: readEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      appId: readEnv(import.meta.env.VITE_FIREBASE_APP_ID),
    })
    auth = getAuth(app)
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    } catch (error) {
      console.warn("Firestore multi-tab persistence unavailable, using single-tab cache", error)
      db = initializeFirestore(app, { localCache: persistentLocalCache() })
    }
  }
  return { auth, db }
}

export function watchAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function completeGoogleRedirect(): Promise<void> {
  if (!isFirebaseConfigured()) return
  await getRedirectResult(getFirebaseAuth())
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
  const firebaseAuth = getFirebaseAuth()
  try {
    await signInWithPopup(firebaseAuth, provider)
  } catch (error) {
    const code = errorCode(error)
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(firebaseAuth, provider)
      return
    }
    throw error
  }
}

export async function signOutGoogle(): Promise<void> {
  await signOut(getFirebaseAuth())
}

export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code)
  }
  return ""
}

export function authErrorMessage(error: unknown): string {
  const code = errorCode(error)
  if (code === "auth/popup-closed-by-user") return "החלון נסגר לפני סיום ההתחברות."
  if (code === "auth/unauthorized-domain") {
    return "הדומיין הזה לא מורשה ב-Firebase. הוסיפו אותו תחת Authentication → Settings."
  }
  if (code === "auth/operation-not-allowed") {
    return "התחברות Google לא הופעלה בפרויקט. הפעילו את ספק Google ב-Authentication."
  }
  return "ההתחברות נכשלה. בדקו ש-Google מאופשר בפרויקט Firebase."
}
