import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 7;

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFileName(): string {
  const date = new Date();
  return `app-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
}

function rotateLogsIfNeeded() {
  const logFiles = fs.readdirSync(LOG_DIR)
    .filter(file => file.endsWith('.log'))
    .map(file => ({
      name: file,
      path: path.join(LOG_DIR, file),
      time: fs.statSync(path.join(LOG_DIR, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  // Delete old files if we have more than MAX_FILES
  if (logFiles.length > MAX_FILES) {
    logFiles.slice(MAX_FILES).forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error(`Failed to delete old log file: ${file.path}`);
      }
    });
  }
}

export const log = (message: string, data?: any) => {
  const time = new Date().toISOString();
  const logFile = path.join(LOG_DIR, getLogFileName());
  
  let logMessage = `[${time}] ${message}`;
  if (data !== undefined) {
    logMessage += ' ' + JSON.stringify(data);
  }
  logMessage += '\n';

  console.log(logMessage.trim());

  try {
    // Create new file if it doesn't exist or if current file is too large
    if (!fs.existsSync(logFile) || fs.statSync(logFile).size >= MAX_FILE_SIZE) {
      rotateLogsIfNeeded();
    }

    // Append to log file
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}; 