'use strict';

/**
 * RC Hotfix Round 5 — short-lived bootstrap restore authorization (pre-login BootFlow only).
 * Single-use, bound to webContents + center + remotePath. Not a general RBAC bypass.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CAPABILITY_TTL_MS = 5 * 60 * 1000;

const BOOTSTRAP_RESTORE_CHANNELS = new Set([
  'backup:v2:restoreFromCloudRemote',
]);

let deps = {
  getUserDataPath: () => '',
  readKv: () => null,
  getCloudStatus: async () => ({ ok: false }),
  readLicense: () => ({ ok: false }),
  getSession: () => null,
};

const capabilities = new Map();

function configure(nextDeps) {
  deps = { ...deps, ...nextDeps };
}

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').trim();
}

function newCapabilityId() {
  return `brc-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, cap] of capabilities) {
    if (cap.expiresAt <= now || cap.consumed) capabilities.delete(id);
  }
}

function revokeForSender(webContentsId) {
  for (const [id, cap] of capabilities) {
    if (cap.webContentsId === webContentsId) capabilities.delete(id);
  }
}

function readSettingsIdentity(userDataPath) {
  try {
    const settingsPath = path.join(userDataPath, 'settings', 'app.json');
    if (!fs.existsSync(settingsPath)) return {};
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    const cloud = settings.cloudV2 || settings.cloud || {};
    return {
      centerId: String(cloud.centerId || settings.centerId || '').slice(0, 128),
      branchId: String(cloud.branchId || settings.branchId || settings.activeBranchId || '').slice(0, 128),
      organizationId: String(cloud.organizationId || cloud.centerId || settings.centerId || '').slice(0, 128),
    };
  } catch {
    return {};
  }
}

function isBootstrapPhase() {
  const wizard = deps.readKv('__tdw_boot_wizard__', null);
  if (wizard && wizard.syncDone === true) return false;
  return true;
}

async function issueRestoreCapability(event, request) {
  purgeExpired();
  const req = request || {};
  if (req.bootFlow !== true) {
    return { ok: false, error: 'restore_authorization_required', message: 'BootFlow context required' };
  }

  const session = deps.getSession(event);
  if (session && session.rank >= 4) {
    return { ok: false, error: 'use_rbac_session', message: 'Use logged-in RBAC session for restore' };
  }

  if (!isBootstrapPhase()) {
    return { ok: false, error: 'bootstrap_restore_not_allowed_app_ready' };
  }

  const centerId = String(req.centerId || '').trim();
  const branchId = String(req.branchId || '').trim();
  const remotePath = normalizePath(req.remotePath);
  const backupId = String(req.backupId || remotePath || '').trim();

  if (!centerId || !remotePath || !backupId) {
    return { ok: false, error: 'restore_authorization_required' };
  }
  if (!/\.tdw$/i.test(remotePath) || !remotePath.includes('Backups/V2')) {
    return { ok: false, error: 'invalid_backup_path' };
  }

  const google = await deps.getCloudStatus('google');
  if (!google?.ok) {
    return { ok: false, error: 'google_not_connected' };
  }

  const settingsId = readSettingsIdentity(deps.getUserDataPath());
  if (settingsId.centerId && settingsId.centerId !== centerId) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }

  const licRes = deps.readLicense(centerId);
  const lic = licRes?.ok ? licRes.data : null;
  if (!lic || !lic.centerId) {
    return { ok: false, error: 'license_not_verified' };
  }
  if (String(lic.centerId) !== centerId) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }

  const licensedBranchIds = (Array.isArray(req.licensedBranchIds) ? req.licensedBranchIds : (lic.branches || []))
    .filter((b) => b && (typeof b === 'string' || b.active !== false))
    .map((b) => (typeof b === 'string' ? b : b.id))
    .filter(Boolean);

  const effectiveBranch = branchId || settingsId.branchId || lic.branchId || '';
  if (effectiveBranch && licensedBranchIds.length && !licensedBranchIds.includes(effectiveBranch)) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }

  const webContentsId = event?.sender?.id;
  if (webContentsId == null) return { ok: false, error: 'no_sender' };

  revokeForSender(webContentsId);

  const capId = newCapabilityId();
  const cap = {
    id: capId,
    webContentsId,
    centerId,
    organizationId: String(req.organizationId || lic.organizationId || centerId).slice(0, 128),
    branchId: effectiveBranch,
    remotePath,
    backupId,
    licensedBranchIds,
    issuedAt: Date.now(),
    expiresAt: Date.now() + CAPABILITY_TTL_MS,
    consumed: false,
  };
  capabilities.set(capId, cap);

  return {
    ok: true,
    capabilityId: capId,
    expiresAt: new Date(cap.expiresAt).toISOString(),
    bound: {
      centerId: cap.centerId,
      branchId: cap.branchId,
      remotePath: cap.remotePath,
    },
  };
}

function tryAuthorizeChannel(event, channel, opts) {
  if (!BOOTSTRAP_RESTORE_CHANNELS.has(channel)) return { ok: false };
  const capId = opts?.bootstrapRestoreCapabilityId;
  if (!capId) return { ok: false };

  purgeExpired();
  const cap = capabilities.get(String(capId));
  if (!cap || cap.consumed) {
    return { ok: false, error: 'restore_authorization_required' };
  }
  if (cap.webContentsId !== event?.sender?.id) {
    return { ok: false, error: 'restore_authorization_required' };
  }
  if (Date.now() > cap.expiresAt) {
    capabilities.delete(cap.id);
    return { ok: false, error: 'restore_authorization_required' };
  }

  const remotePath = normalizePath(opts?.remotePath);
  if (remotePath && remotePath !== cap.remotePath) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }
  const reqCenter = String(opts?.centerId || '').trim();
  if (reqCenter && reqCenter !== cap.centerId) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }
  const reqBranch = String(opts?.branchId || '').trim();
  if (reqBranch && cap.branchId && reqBranch !== cap.branchId) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }

  return { ok: true, capabilityId: cap.id, capability: cap, consumeOnComplete: true, bootstrap: true };
}

function consumeCapability(capabilityId) {
  const cap = capabilities.get(String(capabilityId));
  if (!cap) return { ok: false };
  cap.consumed = true;
  capabilities.delete(cap.id);
  return { ok: true };
}

function assertManifestScope(cap, manifest, scopeTruth) {
  if (!cap) return { ok: true };
  const mCenter = String(manifest?.centerId || scopeTruth?.centerId || '').trim();
  if (mCenter && mCenter !== cap.centerId) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }
  const included = scopeTruth?.includedBranchIds || manifest?.includedBranchIds || [];
  if (cap.branchId && Array.isArray(included) && included.length && !included.includes(cap.branchId)) {
    return { ok: false, error: 'restore_scope_mismatch' };
  }
  return { ok: true };
}

function getCapability(capabilityId) {
  purgeExpired();
  return capabilities.get(String(capabilityId)) || null;
}

module.exports = {
  CAPABILITY_TTL_MS,
  BOOTSTRAP_RESTORE_CHANNELS,
  configure,
  issueRestoreCapability,
  tryAuthorizeChannel,
  consumeCapability,
  assertManifestScope,
  getCapability,
  normalizePath,
  _capabilities: capabilities,
  _purgeExpired: purgeExpired,
};
