import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  getFirestore,
} from "firebase/firestore";

import {
  getDatabase,
} from "firebase/database";

import {
  getStorage,
} from "firebase/storage";

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey:
    process.env
      .NEXT_PUBLIC_FIREBASE_API_KEY,

  authDomain:
    process.env
      .NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId:
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID,

  storageBucket:
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    process.env
      .NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    process.env
      .NEXT_PUBLIC_FIREBASE_APP_ID,

  databaseURL:
    process.env
      .NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app =
  getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

const appCheckSiteKey =
  process.env
    .NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;

if (
  typeof window !== "undefined" &&
  appCheckSiteKey
) {
  const isLocalDevelopment =
    process.env.NODE_ENV ===
      "development" &&
    (
      window.location.hostname ===
        "localhost" ||
      window.location.hostname ===
        "127.0.0.1"
    );

  if (isLocalDevelopment) {
    (
      globalThis as typeof globalThis & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?:
          boolean | string;
      }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }

  try {
    initializeAppCheck(app, {
      provider:
        new ReCaptchaEnterpriseProvider(
          appCheckSiteKey,
        ),

      isTokenAutoRefreshEnabled:
        true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      !message
        .toLowerCase()
        .includes(
          "already been initialized",
        )
    ) {
      throw error;
    }
  }
}

export const auth =
  getAuth(app);

export const db =
  getFirestore(app);

export const rtdb =
  getDatabase(app);

export const storage =
  getStorage(app);