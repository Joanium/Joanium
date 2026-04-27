import { app, safeStorage } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { loadPage } from '../Core/Window.js';
import Paths from '../Core/Paths.js';
import { loadJson, persistJson } from '../Core/FileSystem.js';
import * as AppSettingsService from './AppSettingsService.js';
import { readUser } from './UserService.js';

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_QUESTION_LENGTH = 10;
export const MIN_ANSWER_LENGTH = 2;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const PASSWORD_KEY_LEN = 64;
const LOCAL_ENCRYPTION_KEY_LEN = 32;

const RECORD_VERSION = 2;
const ENVELOPE_VERSION = 1;
const ENVELOPE_MODE_SAFE_STORAGE = 'safe-storage';
const ENVELOPE_MODE_LOCAL = 'local-aes-256-gcm';
const INLINE_STATE_KEY = 'app_lock_state';
const SOURCE_PRIORITY = { primary: 0, backup: 1, inline: 2 };

let sessionLocked = true;
let runtimeLockEnabled = null;
let runtimeIdleTimeoutMinutes = null;
let lastActivityAt = 0;
let idleLockTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function clearIdleLockTimer() {
  if (!idleLockTimer) return;
  clearTimeout(idleLockTimer);
  idleLockTimer = null;
}

function readRuntimeIdleTimeoutMinutes() {
  runtimeIdleTimeoutMinutes = AppSettingsService.readAppSettings().app_lock_idle_minutes;
  return runtimeIdleTimeoutMinutes;
}

function getRuntimeIdleTimeoutMs() {
  const minutes =
    Number.isFinite(runtimeIdleTimeoutMinutes) && runtimeIdleTimeoutMinutes > 0
      ? runtimeIdleTimeoutMinutes
      : readRuntimeIdleTimeoutMinutes();
  return minutes * 60 * 1000;
}

function randomSalt() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSecret(secret, saltHex) {
  return crypto
    .scryptSync(secret, Buffer.from(saltHex, 'hex'), PASSWORD_KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    })
    .toString('hex');
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a ?? ''), 'hex');
  const right = Buffer.from(String(b ?? ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function digestBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeQuestion(question) {
  return String(question ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeAnswer(answer) {
  return String(answer ?? '')
    .trim()
    .toLowerCase();
}

function isHex(value, minLength = 1) {
  return typeof value === 'string' && value.length >= minLength && /^[0-9a-f]+$/i.test(value);
}

function normalizeTimestamp(value, fallback = nowIso()) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function isEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === ENVELOPE_VERSION &&
    typeof value.mode === 'string' &&
    typeof value.payload === 'string',
  );
}

function isLegacyRecord(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.question === 'string' &&
    isHex(value.passwordHash, 32) &&
    isHex(value.passwordSalt, 32) &&
    isHex(value.answerHash, 32) &&
    isHex(value.answerSalt, 32),
  );
}

function normalizeRecord(value) {
  if (!isLegacyRecord(value)) return null;

  const createdAt = normalizeTimestamp(value.createdAt);
  return {
    version: RECORD_VERSION,
    enabled: value.enabled !== false,
    lockId:
      typeof value.lockId === 'string' && value.lockId.trim()
        ? value.lockId.trim()
        : crypto.randomUUID(),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
    question: normalizeQuestion(value.question),
    passwordHash: value.passwordHash,
    passwordSalt: value.passwordSalt,
    answerHash: value.answerHash,
    answerSalt: value.answerSalt,
  };
}

function getLocalEncryptionKey() {
  const identity = [
    app.getName?.() ?? 'Joanium',
    app.getPath('userData'),
    process.platform,
    process.arch,
    os.hostname(),
    os.userInfo().username,
  ].join('|');

  return crypto.scryptSync(identity, 'joanium-app-lock-local-fallback', LOCAL_ENCRYPTION_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

function encryptRecord(record) {
  const plaintext = JSON.stringify(record);

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plaintext);
    return {
      version: ENVELOPE_VERSION,
      mode: ENVELOPE_MODE_SAFE_STORAGE,
      payload: encrypted.toString('base64'),
      digest: digestBuffer(encrypted),
      lockId: record.lockId,
      updatedAt: record.updatedAt,
    };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getLocalEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    version: ENVELOPE_VERSION,
    mode: ENVELOPE_MODE_LOCAL,
    payload: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    lockId: record.lockId,
    updatedAt: record.updatedAt,
  };
}

function decryptEnvelope(envelope) {
  if (!isEnvelope(envelope)) return null;

  try {
    if (envelope.mode === ENVELOPE_MODE_SAFE_STORAGE) {
      const payload = Buffer.from(envelope.payload, 'base64');
      if (digestBuffer(payload) !== envelope.digest) return null;
      return normalizeRecord(JSON.parse(safeStorage.decryptString(payload)));
    }

    if (envelope.mode === ENVELOPE_MODE_LOCAL) {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        getLocalEncryptionKey(),
        Buffer.from(envelope.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(envelope.payload, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return normalizeRecord(JSON.parse(decrypted));
    }
  } catch {
    return null;
  }

  return null;
}

function readInlineEnvelope(user = readUser()) {
  return user?.app_settings?.[INLINE_STATE_KEY] ?? null;
}

function readSources(user = readUser()) {
  return [
    { name: 'primary', raw: loadJson(Paths.APP_LOCK_FILE, null) },
    { name: 'backup', raw: loadJson(Paths.APP_LOCK_BACKUP_FILE, null) },
    { name: 'inline', raw: readInlineEnvelope(user) },
  ].map((source) => {
    if (isEnvelope(source.raw)) {
      return {
        ...source,
        record: decryptEnvelope(source.raw),
        envelope: source.raw,
      };
    }

    const record = normalizeRecord(source.raw);
    return {
      ...source,
      record,
      envelope: record ? encryptRecord(record) : null,
    };
  });
}

function samePayload(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function persistFileEnvelope(filePath, envelope) {
  if (!samePayload(loadJson(filePath, null), envelope)) {
    persistJson(filePath, envelope);
  }
}

function deleteFile(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // best effort
  }
}

function persistInlineEnvelope(user, envelope) {
  const currentSettings = user?.app_settings ?? {};
  const nextSettings = {
    ...currentSettings,
    app_lock: true,
    [INLINE_STATE_KEY]: envelope,
  };

  if (!samePayload(currentSettings, nextSettings)) {
    persistJson(Paths.USER_FILE, { ...user, app_settings: nextSettings });
  }
}

function clearInlineEnvelope() {
  const user = readUser();
  const currentSettings = user?.app_settings ?? {};
  const nextSettings = { ...currentSettings };
  delete nextSettings.app_lock;
  delete nextSettings[INLINE_STATE_KEY];

  if (!samePayload(currentSettings, nextSettings)) {
    persistJson(Paths.USER_FILE, { ...user, app_settings: nextSettings });
  }
}

function selectBestSource(sources = []) {
  return (
    [...sources]
      .filter((source) => source.record?.enabled)
      .sort((left, right) => {
        const updatedDelta =
          Date.parse(right.record?.updatedAt ?? 0) - Date.parse(left.record?.updatedAt ?? 0);
        return updatedDelta || SOURCE_PRIORITY[left.name] - SOURCE_PRIORITY[right.name];
      })[0] ?? null
  );
}

function syncSources(record, envelope, user, sources = []) {
  if (!record || !envelope) return;

  const sourceByName = new Map(sources.map((source) => [source.name, source]));

  if (!samePayload(sourceByName.get('primary')?.raw, envelope)) {
    persistFileEnvelope(Paths.APP_LOCK_FILE, envelope);
  }

  if (!samePayload(sourceByName.get('backup')?.raw, envelope)) {
    persistFileEnvelope(Paths.APP_LOCK_BACKUP_FILE, envelope);
  }

  if (
    user?.app_settings?.app_lock !== true ||
    !samePayload(sourceByName.get('inline')?.raw, envelope)
  ) {
    persistInlineEnvelope(user, envelope);
  }
}

function resolveLockState({ repair = true } = {}) {
  const user = readUser();
  const sources = readSources(user);
  const best = selectBestSource(sources);
  const hasArtifacts = Boolean(
    user?.app_settings?.app_lock ||
    user?.app_settings?.[INLINE_STATE_KEY] ||
    sources.some((source) => source.raw),
  );

  if (!best) {
    return { enabled: false, record: null, hasArtifacts, sources };
  }

  if (repair) {
    syncSources(best.record, best.envelope, user, sources);
  }

  return { enabled: true, record: best.record, hasArtifacts: true, sources };
}

function persistRecord(record) {
  const user = readUser();
  const envelope = encryptRecord(record);
  persistFileEnvelope(Paths.APP_LOCK_FILE, envelope);
  persistFileEnvelope(Paths.APP_LOCK_BACKUP_FILE, envelope);
  persistInlineEnvelope(user, envelope);
  return record;
}

function readActiveRecord() {
  return resolveLockState().record;
}

function invalidConfigurationMessage() {
  return 'App lock data is missing or corrupted.';
}

export function isAppLockEnabled() {
  const state = resolveLockState();
  runtimeLockEnabled = state.enabled || state.hasArtifacts;
  return runtimeLockEnabled;
}

function isRuntimeLockEnabled() {
  return typeof runtimeLockEnabled === 'boolean' ? runtimeLockEnabled : isAppLockEnabled();
}

function scheduleIdleLock() {
  clearIdleLockTimer();

  if (sessionLocked || !isRuntimeLockEnabled()) return;

  const timeoutMs = getRuntimeIdleTimeoutMs();
  if (!timeoutMs || !lastActivityAt) return;

  const dueIn = Math.max(timeoutMs - (Date.now() - lastActivityAt), 0);
  idleLockTimer = setTimeout(() => {
    idleLockTimer = null;

    if (
      !sessionLocked &&
      isRuntimeLockEnabled() &&
      Date.now() - lastActivityAt >= getRuntimeIdleTimeoutMs()
    ) {
      lockApp();
      return;
    }

    scheduleIdleLock();
  }, dueIn);
  idleLockTimer.unref?.();
}

export function refreshIdleLockTimer({ bumpActivity = false } = {}) {
  runtimeIdleTimeoutMinutes = AppSettingsService.readAppSettings().app_lock_idle_minutes;

  if (!isRuntimeLockEnabled()) {
    clearIdleLockTimer();
    sessionLocked = false;
    return;
  }

  if (sessionLocked) {
    clearIdleLockTimer();
    return;
  }

  if (bumpActivity || !lastActivityAt) lastActivityAt = Date.now();
  scheduleIdleLock();
}

export function markActivity() {
  if (sessionLocked || !isRuntimeLockEnabled()) return;
  lastActivityAt = Date.now();
  scheduleIdleLock();
}

export function lockApp() {
  if (!isRuntimeLockEnabled()) return { ok: false, error: 'App lock is not enabled.' };
  if (sessionLocked) return { ok: true };

  sessionLocked = true;
  clearIdleLockTimer();
  loadPage(Paths.LOCK_PAGE);
  return { ok: true };
}

export function unlockApp() {
  sessionLocked = false;
  lastActivityAt = Date.now();
  scheduleIdleLock();
  setTimeout(() => loadPage(Paths.INDEX_PAGE), 120);
  return { ok: true };
}

export function setupAppLock({ password, question, answer } = {}) {
  const normalizedQuestion = normalizeQuestion(question);
  const normalizedAnswer = String(answer ?? '').trim();

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (normalizedQuestion.length < MIN_QUESTION_LENGTH) {
    return {
      ok: false,
      error: `Recovery question must be at least ${MIN_QUESTION_LENGTH} characters.`,
    };
  }

  if (normalizedAnswer.length < MIN_ANSWER_LENGTH) {
    return {
      ok: false,
      error: `Recovery answer must be at least ${MIN_ANSWER_LENGTH} characters.`,
    };
  }

  const createdAt = nowIso();
  const pwSalt = randomSalt();
  const answerSalt = randomSalt();
  persistRecord({
    version: RECORD_VERSION,
    enabled: true,
    lockId: crypto.randomUUID(),
    createdAt,
    updatedAt: createdAt,
    question: normalizedQuestion,
    passwordHash: hashSecret(password, pwSalt),
    passwordSalt: pwSalt,
    answerHash: hashSecret(normalizeAnswer(normalizedAnswer), answerSalt),
    answerSalt,
  });

  runtimeLockEnabled = true;
  sessionLocked = false;
  lastActivityAt = Date.now();
  refreshIdleLockTimer();
  return { ok: true };
}

export function verifyPassword(password) {
  if (typeof password !== 'string' || !password) {
    return { ok: false, error: 'Please enter your password.' };
  }

  const state = resolveLockState();
  if (!state.record) {
    return {
      ok: false,
      error: state.hasArtifacts ? invalidConfigurationMessage() : 'App lock is not configured.',
    };
  }

  const hash = hashSecret(password, state.record.passwordSalt);
  return safeCompare(hash, state.record.passwordHash)
    ? { ok: true }
    : { ok: false, error: 'Incorrect password. Please try again.' };
}

export function getRecoveryQuestion() {
  return readActiveRecord()?.question ?? null;
}

export function verifyRecoveryAnswer(answer) {
  if (typeof answer !== 'string' || !answer.trim()) {
    return { ok: false, error: 'Please enter your answer.' };
  }

  const state = resolveLockState();
  if (!state.record) {
    return {
      ok: false,
      error: state.hasArtifacts ? invalidConfigurationMessage() : 'App lock is not configured.',
    };
  }

  const hash = hashSecret(normalizeAnswer(answer), state.record.answerSalt);
  return safeCompare(hash, state.record.answerHash)
    ? { ok: true }
    : { ok: false, error: 'Incorrect answer. Please try again.' };
}

export function resetPassword(newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const record = readActiveRecord();
  if (!record) {
    return { ok: false, error: invalidConfigurationMessage() };
  }

  const passwordSalt = randomSalt();
  persistRecord({
    ...record,
    updatedAt: nowIso(),
    passwordHash: hashSecret(newPassword, passwordSalt),
    passwordSalt,
  });

  return { ok: true };
}

export function disableAppLock(password) {
  const verification = verifyPassword(password);
  if (!verification.ok) return verification;

  deleteFile(Paths.APP_LOCK_FILE);
  deleteFile(Paths.APP_LOCK_BACKUP_FILE);
  clearInlineEnvelope();
  runtimeLockEnabled = false;
  sessionLocked = false;
  lastActivityAt = 0;
  clearIdleLockTimer();
  return { ok: true };
}
