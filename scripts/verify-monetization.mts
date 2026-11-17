/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  migrateDatabase,
  readSchemaVersion,
  type PersistenceDatabase,
} from '../src/persistence/database.ts';
import {
  addLiveClassPasses,
  clearAllLocalData,
  consumeLiveClassPass,
  grantBonusBoardSlot,
  grantRewardedUnlock,
  incrementHostedVoiceTrial,
  insertBoard,
  loadMonetizationState,
  recordInterstitialShown,
  resetDevMonetizationState,
  updateMonetizationEntitlements,
} from '../src/persistence/repository.ts';
import {
  DEFAULT_BOARD_SETTINGS,
  DEFAULT_MONETIZATION_STATE,
  SCHEMA_VERSION,
  parsePersistedEntitlements,
  parseRewardedUnlocks,
} from '../src/persistence/schema.ts';
import {
  AD_POLICY_CONSTANTS,
  IAP_PRODUCTS,
  TIER_LIMITS,
  resolveIapEnvironment,
  resolveUserPlanTier,
} from '../src/monetization/iap-catalog.ts';
import {
  canAddBoardPage,
  canCreateBoard,
  canUseBoardStyle,
  canUseGeometryTool,
  evaluateLiveClassModeAccess,
  getEffectiveLimits,
  getEffectiveTier,
  hasFeatureAccess,
  shouldShowPostExportInterstitial,
} from '../src/monetization/entitlement-service.ts';

function openTestDatabase(filename = ':memory:'): {
  database: PersistenceDatabase;
  close: () => void;
} {
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON');
  const database: PersistenceDatabase = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params = []) {
      const result = raw.prepare(source).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    async getAllAsync<T>(source: string, params = []) {
      return raw.prepare(source).all(...params).map((row) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(source: string, params = []) {
      const row = raw.prepare(source).get(...params);
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { database, close: () => raw.close() };
}

function testCatalogAndParsers(): void {
  assert.equal(resolveIapEnvironment(undefined), 'development');
  assert.equal(resolveIapEnvironment('production'), 'production');
  assert.equal(resolveIapEnvironment('PRODUCTION'), 'production');

  assert.equal(IAP_PRODUCTS.length, 6);
  const annual = IAP_PRODUCTS.find((p) => p.key === 'teacher_pro_annual');
  assert.ok(annual);
  assert.equal(annual.introTrialDays, 7);
  assert.equal(annual.referenceUsdPrice, '$19.99/yr');
  assert.notEqual(annual.storeIds.development.ios, annual.storeIds.production.ios);

  assert.equal(resolveUserPlanTier([]), 'free');
  assert.equal(resolveUserPlanTier(['ad_free']), 'ad_free');
  assert.equal(resolveUserPlanTier(['ad_free', 'offline_studio']), 'offline_studio');
  assert.equal(resolveUserPlanTier(['ad_free', 'teacher_pro']), 'teacher_pro');

  assert.deepEqual(parsePersistedEntitlements('["ad_free","invalid","ad_free"]'), ['ad_free']);
  assert.deepEqual(parsePersistedEntitlements('bad-json'), []);
  assert.deepEqual(
    parseRewardedUnlocks(JSON.stringify({ pdf_import: '2026-12-01T00:00:00.000Z', bad: 'not-a-date' })),
    { pdf_import: '2026-12-01T00:00:00.000Z' },
  );
}

async function testSqliteMonetizationPersistence(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'flowcanvas-monetization-'));
  const dbPath = join(dir, 'test.db');

  try {
    const db1 = openTestDatabase(dbPath);
    await migrateDatabase(db1.database);
    assert.equal(await readSchemaVersion(db1.database), SCHEMA_VERSION);

    const initial = await loadMonetizationState(db1.database);
    assert.deepEqual(initial.activeEntitlements, DEFAULT_MONETIZATION_STATE.activeEntitlements);
    assert.equal(initial.liveClassPasses, 0);
    assert.equal(initial.hostedVoiceTrialCount, 0);

    await incrementHostedVoiceTrial(db1.database);
    await grantBonusBoardSlot(db1.database, 2);
    await addLiveClassPasses(db1.database, 5);
    const consumed = await consumeLiveClassPass(db1.database);
    assert.equal(consumed.consumed, true);
    assert.equal(consumed.state.liveClassPasses, 4);

    await grantRewardedUnlock(db1.database, 'pdf_import', '2027-01-01T00:00:00.000Z');
    await updateMonetizationEntitlements(db1.database, ['ad_free', 'offline_studio'], null);
    await recordInterstitialShown(db1.database, '2026-11-17T00:00:00.000Z');

    // Clearing local user boards should NOT wipe monetization trials/passes/entitlements.
    await insertBoard(db1.database, {
      id: 'b1',
      title: 'Test',
      settings: DEFAULT_BOARD_SETTINGS,
      createdAt: '2026-11-17T00:00:00.000Z',
    });
    await clearAllLocalData(db1.database);
    db1.close();

    // Reopen from disk to verify persistence across restarts.
    const db2 = openTestDatabase(dbPath);
    const restored = await loadMonetizationState(db2.database);
    assert.deepEqual(restored.activeEntitlements, ['ad_free', 'offline_studio']);
    assert.equal(restored.hostedVoiceTrialCount, 1);
    assert.equal(restored.bonusBoardSlots, 2);
    assert.equal(restored.liveClassPasses, 4);
    assert.equal(restored.rewardedUnlocks.pdf_import, '2027-01-01T00:00:00.000Z');
    assert.equal(restored.lastInterstitialAt, '2026-11-17T00:00:00.000Z');

    const reset = await resetDevMonetizationState(db2.database);
    assert.deepEqual(reset.activeEntitlements, []);
    assert.equal(reset.liveClassPasses, 0);
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testTierLimitsAndRewardedUnlocks(): void {
  const now = Date.parse('2026-11-17T12:00:00.000Z');
  const futureIso = new Date(now + AD_POLICY_CONSTANTS.rewardedUnlockDurationMs).toISOString();
  const pastIso = new Date(now - 60_000).toISOString();

  // Free tier defaults
  const freeState = { ...DEFAULT_MONETIZATION_STATE };
  assert.equal(getEffectiveTier(freeState, now), 'free');
  assert.equal(canCreateBoard(freeState, 4, now).allowed, true);
  assert.equal(canCreateBoard(freeState, 5, now).allowed, false);
  assert.equal(canCreateBoard({ ...freeState, bonusBoardSlots: 1 }, 5, now).allowed, true);

  assert.equal(canAddBoardPage(freeState, 1, now), false);
  assert.equal(canUseBoardStyle(freeState, 'grid', now), true);
  assert.equal(canUseBoardStyle(freeState, 'ruled', now), false);
  assert.equal(canUseGeometryTool(freeState, 'ruler', now), true);
  assert.equal(canUseGeometryTool(freeState, 'protractor', now), false);
  assert.equal(hasFeatureAccess(freeState, 'pdf_import', now).allowed, false);
  assert.equal(hasFeatureAccess(freeState, 'face_cam', now).allowed, false);

  const freeLimits = getEffectiveLimits(freeState, now);
  assert.equal(freeLimits.lessonRecorderMaxSeconds, 240);
  assert.equal(freeLimits.lessonRecorderMaxQuality, '480p');
  assert.equal(freeLimits.lessonRecorderWatermark, true);

  // Rewarded ad 24h unlock + expiration
  const rewardedState = {
    ...freeState,
    rewardedUnlocks: {
      pdf_import: futureIso,
      geometry_pro: pastIso,
    },
  };
  assert.deepEqual(hasFeatureAccess(rewardedState, 'pdf_import', now), {
    allowed: true,
    via: 'rewarded_ad',
    rewardExpiresAt: futureIso,
  });
  assert.equal(hasFeatureAccess(rewardedState, 'geometry_pro', now).allowed, false);

  // Interstitial cooldown
  assert.equal(shouldShowPostExportInterstitial(freeState, now), true);
  assert.equal(
    shouldShowPostExportInterstitial({ ...freeState, lastInterstitialAt: new Date(now - 60_000).toISOString() }, now),
    false,
  );
  assert.equal(
    shouldShowPostExportInterstitial(
      { ...freeState, lastInterstitialAt: new Date(now - AD_POLICY_CONSTANTS.interstitialCooldownMs - 1).toISOString() },
      now,
    ),
    true,
  );

  // Live Class mode split: Board-Only vs Live Voice
  const boardOnlyFree = evaluateLiveClassModeAccess(freeState, 'board-only', now);
  assert.equal(boardOnlyFree.allowed, false);
  assert.equal(boardOnlyFree.requiresRewardedAd, true);
  assert.equal(boardOnlyFree.maxStudents, 1);
  assert.equal(boardOnlyFree.ephemeralIntervalMs, 66);

  const boardOnlyUnlocked = evaluateLiveClassModeAccess(
    { ...freeState, rewardedUnlocks: { board_only_live_class: futureIso } },
    'board-only',
    now,
  );
  assert.equal(boardOnlyUnlocked.allowed, true);

  const voiceTrial = evaluateLiveClassModeAccess(freeState, 'voice', now);
  assert.equal(voiceTrial.allowed, true);
  assert.equal(voiceTrial.willUseTrial, true);
  assert.equal(voiceTrial.remainingVoiceTrials, 3);

  const voiceExhausted = evaluateLiveClassModeAccess(
    { ...freeState, hostedVoiceTrialCount: 3 },
    'voice',
    now,
  );
  assert.equal(voiceExhausted.allowed, false);

  const voiceWithPass = evaluateLiveClassModeAccess(
    { ...freeState, hostedVoiceTrialCount: 3, liveClassPasses: 2 },
    'voice',
    now,
  );
  assert.equal(voiceWithPass.allowed, true);
  assert.equal(voiceWithPass.willConsumePass, true);
  assert.equal(voiceWithPass.maxStudents, 1);

  // Offline Studio vs Teacher Pro
  const studioState = {
    ...freeState,
    activeEntitlements: ['ad_free', 'offline_studio'] as const as ('ad_free' | 'offline_studio')[],
  };
  assert.equal(getEffectiveTier(studioState, now), 'offline_studio');
  assert.equal(hasFeatureAccess(studioState, 'pdf_import', now).allowed, true);
  assert.equal(hasFeatureAccess(studioState, 'face_cam', now).allowed, false);
  assert.equal(shouldShowPostExportInterstitial(studioState, now), false);

  const proState = {
    ...freeState,
    activeEntitlements: ['ad_free', 'teacher_pro'] as const as ('ad_free' | 'teacher_pro')[],
    cachedExpiresAt: new Date(now + 86_400_000).toISOString(),
  };
  assert.equal(getEffectiveTier(proState, now), 'teacher_pro');
  const proLimits = getEffectiveLimits(proState, now);
  assert.equal(proLimits.lessonVideoUnlimitedEnabled, true);
  assert.equal(proLimits.lessonRecorderMaxQuality, '1080p');
  assert.equal(proLimits.lessonRecorderWatermark, false);
  assert.equal(proLimits.faceCamPipEnabled, true);
  const proVoice = evaluateLiveClassModeAccess(proState, 'voice', now);
  assert.equal(proVoice.allowed, true);
  assert.equal(proVoice.maxStudents, TIER_LIMITS.teacher_pro.liveVoiceClass.maxStudents);

  // Expired cache falls back cleanly to free
  const expiredProState = { ...proState, cachedExpiresAt: pastIso };
  assert.equal(getEffectiveTier(expiredProState, now), 'free');
}

async function run(): Promise<void> {
  testCatalogAndParsers();
  await testSqliteMonetizationPersistence();
  testTierLimitsAndRewardedUnlocks();
  console.log('monetization checks passed: IAP catalog, SQLite Migration 5 roundtrip, tier limits, rewarded unlocks, and live class mode gating');
}

void run();
