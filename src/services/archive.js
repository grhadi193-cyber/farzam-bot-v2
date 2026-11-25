'use strict';
// Optional Google Drive mirror. Archive only — never the queue, never the
// source of truth. Disabled until DRIVE_ARCHIVE_FOLDER_ID is set, so a
// fresh install cannot silently write company files to the wrong place.
function archiveEnabled() {
  return Boolean(process.env.DRIVE_ARCHIVE_FOLDER_ID);
}
async function archiveEvent() {
  if (!archiveEnabled()) return { status: 'disabled', note: 'DRIVE_ARCHIVE_FOLDER_ID is not set' };
  // Implemented when the Drive service account is wired in. Until then the
  // local file store in data/files/ is the only copy.
  return { status: 'not_implemented', note: 'Drive archive is not wired in yet' };
}
module.exports = { archiveEnabled, archiveEvent };
