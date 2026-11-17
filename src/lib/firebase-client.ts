// 前端 Firebase Auth（只用來 Google 登入，讓 AI 出題帶上身分）。
// 設定值由 GitHub Actions 的 Secrets 在建置時注入（NEXT_PUBLIC_FIREBASE_*），原始碼不放任何金鑰。
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isAuthConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let _auth: Auth | null = null;
function auth(): Auth {
  if (!_auth) {
    const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
    _auth = getAuth(app);
  }
  return _auth;
}

export type { User };

export function isGoogleUser(u: User | null | undefined): u is User {
  return Boolean(u && !u.isAnonymous && u.providerData.some((p) => p.providerId === 'google.com'));
}

export function onUserChange(cb: (u: User | null) => void): () => void {
  if (!isAuthConfigured()) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth(), cb);
}

export async function signInWithGoogle(): Promise<User | null> {
  // App 內建瀏覽器（LINE／FB 等）：Google 禁止在此登入（403 disallowed_useragent）。
  // 頁首防護會自動跳轉／引導；使用者按「先不登入，繼續瀏覽」後又按登入時，在這裡再提醒一次，不開登入視窗。
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK|\bLine\//i.test(navigator.userAgent || '')) {
      try { window.alert('您目前在 App 內建瀏覽器（LINE／FB 等）中，Google 基於安全政策禁止在此登入。\n\n請點右上／右下角「⋯」→ 選「用預設瀏覽器開啟」後再登入。'); } catch (e) { }
      return null;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth(), provider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  if (!isAuthConfigured()) return;
  await signOut(auth());
}

/** 目前 Google 登入者的 ID Token；沒登入回 null */
export async function getIdTokenOrNull(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const u = auth().currentUser;
  if (!isGoogleUser(u)) return null;
  return u.getIdToken();
}

/** 把 Firebase 登入錯誤翻成老師看得懂的中文 */
export function loginErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '已取消登入。';
  if (code === 'auth/popup-blocked') return '瀏覽器擋住了登入視窗，請允許此網站的彈出視窗後再試一次。';
  if (code === 'auth/unauthorized-domain') return '這個網址尚未開放登入，請改用正式網站開啟。';
  if (code === 'auth/network-request-failed') return '網路連線不穩，請稍後再試。';
  return '登入失敗，請再試一次。';
}
