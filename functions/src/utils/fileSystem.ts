// functions/src/utils/fileSystem.ts - Node.js replacement for expo-file-system
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

export const documentDirectory = path.join(os.tmpdir(), 'dream-ai/');

// Create directory if it doesn't exist
if (!fs.existsSync(documentDirectory)) {
  fs.mkdirSync(documentDirectory, { recursive: true });
}

export async function downloadAsync(url: string, fileUri: string): Promise<{ uri: string }> {
  console.log(`📥 Downloading: ${url}`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(fileUri, Buffer.from(response.data));
  console.log(`✅ Downloaded to: ${fileUri}`);
  return { uri: fileUri };
}

export async function writeAsStringAsync(
  fileUri: string, 
  contents: string, 
  options?: { encoding?: string }
): Promise<void> {
  const encoding = options?.encoding === 'Base64' ? 'base64' : 'utf8';
  fs.writeFileSync(fileUri, contents, encoding as any);
}

export async function readAsStringAsync(
  fileUri: string, 
  options?: { encoding?: string }
): Promise<string> {
  const encoding = options?.encoding === 'Base64' ? 'base64' : 'utf8';
  const buffer = fs.readFileSync(fileUri, encoding as any);
  return buffer.toString(); // 🔥 FIX: Convert Buffer to string
}

export async function getInfoAsync(fileUri: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const stats = fs.statSync(fileUri);
    return { exists: true, size: stats.size };
  } catch {
    return { exists: false };
  }
}

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};
