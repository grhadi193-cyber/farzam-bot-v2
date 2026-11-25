'use strict';
// Persian voice transcription with faster-whisper, language fa.
// Pip already has a verified venv at ~/workspace/venvs/whisper (small
// model, language fa). If no whisper python is available, transcription
// is reported as not_configured — never guessed, never faked.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const config = require('../config');

function whisperPython() {
  if (config.whisperPython && fs.existsSync(config.whisperPython)) return config.whisperPython;
  const def = path.join(process.env.HOME || '', 'workspace', 'venvs', 'whisper', 'bin', 'python');
  if (fs.existsSync(def)) return def;
  return null;
}
function transcribeVoice(filePath) {
  return new Promise((resolve) => {
    const python = whisperPython();
    if (!python) return resolve({ status: 'not_configured', transcript: null, note: 'No faster-whisper python is available (WHISPER_PYTHON is unset and the default venv is missing)' });
    const script = path.join(__dirname, '..', '..', 'scripts', 'transcribe.py');
    execFile(python, [script, filePath, config.whisperModel], { timeout: 180000 }, (err, stdout) => {
      if (err) return resolve({ status: 'failed', transcript: null, note: `transcription failed: ${err.message}` });
      try {
        const out = JSON.parse(stdout);
        return resolve({ status: out.text ? 'ok' : 'failed', transcript: out.text || null, note: out.text ? null : 'transcription returned no text' });
      } catch (_) {
        return resolve({ status: 'failed', transcript: null, note: 'transcription returned invalid JSON' });
      }
    });
  });
}
module.exports = { transcribeVoice, whisperPython };
