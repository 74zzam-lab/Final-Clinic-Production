'use strict';

/**
 * Tombstone (soft-delete) sync rules — delete vs update conflicts, tombstone retention.
 */

function isTombstone(record) {
  return !!(record && record.deletedAt);
}

function tombstoneTime(record) {
  if (!record?.deletedAt) return 0;
  const t = new Date(record.deletedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

const ACTIONS = {
  SKIP: 'skip',
  PUSH: 'push',
  PULL: 'pull',
  CONFLICT: 'conflict',
};

/**
 * Tombstone-only merge decision. Returns null when neither side is tombstoned.
 */
function decideTombstone(local, remote, table) {
  const localT = isTombstone(local);
  const remoteT = isTombstone(remote);
  if (!localT && !remoteT) return null;

  if (localT && remoteT) {
    const lt = tombstoneTime(local);
    const rt = tombstoneTime(remote);
    if (lt === rt && JSON.stringify(local) === JSON.stringify(remote)) {
      return { action: ACTIONS.SKIP, reason: 'both_tombstone_identical', table };
    }
    if (lt > rt) {
      return { action: ACTIONS.PUSH, reason: 'tombstone_newer_local', tombstone: local, table };
    }
    if (rt > lt) {
      return { action: ACTIONS.PULL, reason: 'tombstone_newer_remote', tombstone: remote, table };
    }
    const lr = Number(local?.revision) || 0;
    const rr = Number(remote?.revision) || 0;
    if (lr >= rr) {
      return { action: ACTIONS.PUSH, reason: 'tombstone_revision_local', tombstone: local, table };
    }
    return { action: ACTIONS.PULL, reason: 'tombstone_revision_remote', tombstone: remote, table };
  }

  if (localT && !remoteT) {
    return {
      action: ACTIONS.CONFLICT,
      reason: 'delete_vs_update',
      fields: ['deletedAt'],
      local,
      remote,
      table,
    };
  }

  return {
    action: ACTIONS.CONFLICT,
    reason: 'update_vs_delete',
    fields: ['deletedAt'],
    local,
    remote,
    table,
  };
}

function shouldOpenConflict(local, remote) {
  const decision = decideTombstone(local, remote);
  if (!decision) return false;
  return decision.action === ACTIONS.CONFLICT;
}

function recordsConflict(local, remote) {
  if (shouldOpenConflict(local, remote)) return true;
  if (isTombstone(local) || isTombstone(remote)) return false;
  return JSON.stringify(local) !== JSON.stringify(remote);
}

function applyTombstone(record, prev, ctx) {
  ctx = ctx || {};
  const ts = new Date().toISOString();
  let row = {
    ...(record || {}),
    deletedAt: record?.deletedAt || ts,
    updatedAt: ts,
  };
  if (typeof ctx.stampUpdate === 'function') {
    row = ctx.stampUpdate(row, prev || record, ctx);
  } else if (prev && typeof prev === 'object') {
    const prevRev = Number(prev.revision) || Number(row.revision) || 0;
    row.revision = prevRev + 1;
    row.createdAt = row.createdAt || prev.createdAt || ts;
    row.deviceId = row.deviceId || prev.deviceId || 'unknown';
    row.branchId = row.branchId || prev.branchId || ctx.branchId || 'BR-MAIN';
  }
  return row;
}

module.exports = {
  ACTIONS,
  isTombstone,
  tombstoneTime,
  decideTombstone,
  shouldOpenConflict,
  recordsConflict,
  applyTombstone,
};
