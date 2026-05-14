// src/hooks/useAuth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Auth logic for PigeonSocial.
//
// This is a LOCAL-ONLY auth system using localStorage. It is intentionally
// simple because this app runs exclusively on your own machine.
// Do NOT expose this app to the internet without replacing this with a real
// auth system (e.g. bcrypt + JWT + a real database).
//
// Storage keys:
//   pigeon_users   → JSON array of User objects (the "user database")
//   pigeon_session → JSON Session object (the active login)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { User, Session } from '@/types';

/** How many days a login session lasts before requiring re-authentication. */
const SESSION_TTL_DAYS = 21;

const STORAGE_KEY_USERS   = 'pigeon_users';
const STORAGE_KEY_SESSION = 'pigeon_session';

// ── LocalStorage helpers ──────────────────────────────────────────────────────

/** Reads and parses the users array from localStorage. Returns [] if none. */
function loadUsers(): User[] {
  try {
    const rawJson = localStorage.getItem(STORAGE_KEY_USERS);
    return rawJson ? (JSON.parse(rawJson) as User[]) : [];
  } catch {
    return [];
  }
}

/** Serialises and writes the users array to localStorage. */
function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

/** Reads and validates the current session from localStorage. Returns null if none/expired. */
function loadSession(): Session | null {
  try {
    const rawJson = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!rawJson) return null;

    const session = JSON.parse(rawJson) as Session;

    // Treat the session as expired if the expiry datetime has passed
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/** Writes a new session to localStorage. */
function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
}

/** Clears the session from localStorage (logout). */
function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

// ── Password encoding ─────────────────────────────────────────────────────────

/**
 * Encodes a password to base64 for localStorage storage.
 * NOT cryptographically secure — only appropriate for a local-only app.
 */
function encodePassword(plainTextPassword: string): string {
  return btoa(unescape(encodeURIComponent(plainTextPassword)));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseAuthReturn {
  /** The active session, or null if not logged in. */
  session: Session | null;

  /** Whether the user is currently logged in with a valid session. */
  isLoggedIn: boolean;

  /**
   * Attempts to log in with the given credentials.
   * Returns an error message string on failure, or null on success.
   */
  login: (username: string, password: string) => string | null;

  /**
   * Creates a new user account with the given credentials.
   * Returns an error message string on failure, or null on success.
   */
  createAccount: (username: string, password: string) => string | null;

  /** Ends the current session. */
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  // Initialise session state from localStorage on first render
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const login = useCallback((username: string, password: string): string | null => {
    if (!username.trim() || !password) return 'Username and password are required.';

    const users             = loadUsers();
    const encodedPassword   = encodePassword(password);
    const matchingUser      = users.find(
      (user) =>
        user.username.toLowerCase() === username.trim().toLowerCase() &&
        user.passwordEncoded === encodedPassword
    );

    if (!matchingUser) return 'Incorrect username or password.';

    // Create a new session that lasts SESSION_TTL_DAYS days
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SESSION_TTL_DAYS);

    const newSession: Session = {
      userId:    matchingUser.id,
      username:  matchingUser.username,
      expiresAt: expiryDate.toISOString(),
    };

    saveSession(newSession);
    setSession(newSession);
    return null; // null = success
  }, []);

  const createAccount = useCallback((username: string, password: string): string | null => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername)    return 'Username is required.';
    if (trimmedUsername.length < 3) return 'Username must be at least 3 characters.';
    if (!password)           return 'Password is required.';
    if (password.length < 4) return 'Password must be at least 4 characters.';

    const existingUsers = loadUsers();
    const usernameAlreadyTaken = existingUsers.some(
      (user) => user.username.toLowerCase() === trimmedUsername.toLowerCase()
    );

    if (usernameAlreadyTaken) return `Username "${trimmedUsername}" is already taken.`;

    const newUser: User = {
      id:              uuidv4(),
      username:        trimmedUsername,
      passwordEncoded: encodePassword(password),
      createdAt:       new Date().toISOString(),
    };

    saveUsers([...existingUsers, newUser]);

    // Auto-login after account creation
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SESSION_TTL_DAYS);

    const newSession: Session = {
      userId:    newUser.id,
      username:  newUser.username,
      expiresAt: expiryDate.toISOString(),
    };

    saveSession(newSession);
    setSession(newSession);
    return null;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return {
    session,
    isLoggedIn: session !== null,
    login,
    createAccount,
    logout,
  };
}
