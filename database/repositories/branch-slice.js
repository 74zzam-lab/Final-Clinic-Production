'use strict';

const DEFAULT_BRANCH_ID = 'BR-MAIN';

function normalizeBranchId(branchId) {
  return String(branchId || DEFAULT_BRANCH_ID);
}

function assertRecordBranch(record, branchId) {
  const bid = normalizeBranchId(branchId);
  const recBranch = record?.branchId || (bid === DEFAULT_BRANCH_ID ? DEFAULT_BRANCH_ID : null);
  if (!record || typeof record !== 'object') {
    throw Object.assign(new Error('record_invalid'), { code: 'record_invalid' });
  }
  if (recBranch !== bid) {
    throw Object.assign(new Error('branch_id_tamper'), { code: 'branch_id_tamper' });
  }
}

function recordMatchesBranch(record, branchId) {
  const bid = normalizeBranchId(branchId);
  if (!record || typeof record !== 'object') return false;
  if (record.branchId) return record.branchId === bid;
  return bid === DEFAULT_BRANCH_ID;
}

function selectIdsForBranch(db, tableName, branchId) {
  const bid = normalizeBranchId(branchId);
  if (bid === DEFAULT_BRANCH_ID) {
    return db.prepare(
      `SELECT id FROM ${tableName} WHERE branch_id = ? OR branch_id IS NULL`
    ).all(bid);
  }
  return db.prepare(`SELECT id FROM ${tableName} WHERE branch_id = ?`).all(bid);
}

function countForBranch(db, tableName, branchId) {
  const bid = normalizeBranchId(branchId);
  if (bid === DEFAULT_BRANCH_ID) {
    return db.prepare(
      `SELECT COUNT(*) AS c FROM ${tableName} WHERE branch_id = ? OR branch_id IS NULL`
    ).get(bid).c;
  }
  return db.prepare(`SELECT COUNT(*) AS c FROM ${tableName} WHERE branch_id = ?`).get(bid).c;
}

function getByIdScoped(db, tableName, id, branchId) {
  const row = db.prepare(
    `SELECT payload_json, branch_id FROM ${tableName} WHERE id = ?`
  ).get(String(id));
  if (!row) return null;
  const bid = normalizeBranchId(branchId);
  if (row.branch_id && row.branch_id !== bid) return null;
  if (!row.branch_id && bid !== DEFAULT_BRANCH_ID) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

function replaceBranchSlice(db, tableName, repo, list, branchId, onBeforeDelete) {
  const bid = normalizeBranchId(branchId);
  const tx = db.transaction((items, b) => {
    const ids = new Set();
    for (const item of items || []) {
      assertRecordBranch({ ...item, branchId: item.branchId || b }, b);
      repo.upsert({ ...item, branchId: item.branchId || b });
      ids.add(String(item.id));
    }
    for (const row of selectIdsForBranch(db, tableName, b)) {
      if (ids.has(String(row.id))) continue;
      if (onBeforeDelete) onBeforeDelete(row.id);
      db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(row.id);
    }
  });
  tx(list, bid);
}

function listForBranch(db, tableName, branchId) {
  const bid = normalizeBranchId(branchId);
  const rows = selectIdsForBranch(db, tableName, bid);
  const out = [];
  for (const row of rows) {
    const full = db.prepare(
      `SELECT payload_json FROM ${tableName} WHERE id = ?`
    ).get(String(row.id));
    if (!full) continue;
    try {
      out.push(JSON.parse(full.payload_json));
    } catch { /* skip corrupt */ }
  }
  return out;
}

function sumTotalForBranch(db, branchId) {
  const bid = normalizeBranchId(branchId);
  if (bid === DEFAULT_BRANCH_ID) {
    return db.prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM visits WHERE branch_id = ? OR branch_id IS NULL`
    ).get(bid).s;
  }
  return db.prepare(
    `SELECT COALESCE(SUM(total),0) AS s FROM visits WHERE branch_id = ?`
  ).get(bid).s;
}

function replaceAttendanceBranchSlice(db, repo, list, branchId) {
  const bid = normalizeBranchId(branchId);
  const tx = db.transaction((items, b) => {
    const ids = new Set();
    for (const item of items || []) {
      assertRecordBranch({ ...item, branchId: item.branchId || b }, b);
      repo.upsert(item);
      ids.add(String(item.id));
    }
    for (const row of db.prepare('SELECT id, payload_json FROM attendance').all()) {
      let payload;
      try { payload = JSON.parse(row.payload_json); } catch { continue; }
      if (!recordMatchesBranch(payload, b)) continue;
      if (!ids.has(String(row.id))) {
        db.prepare('DELETE FROM attendance WHERE id = ?').run(row.id);
      }
    }
  });
  tx(list, bid);
}

module.exports = {
  DEFAULT_BRANCH_ID,
  normalizeBranchId,
  assertRecordBranch,
  recordMatchesBranch,
  selectIdsForBranch,
  countForBranch,
  getByIdScoped,
  replaceBranchSlice,
  replaceAttendanceBranchSlice,
  listForBranch,
  sumTotalForBranch,
};
