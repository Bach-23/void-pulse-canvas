import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Void Pulse Canvas - Snapshot Generator (Raw Buffer Concatenation / ESM Edition)
// ============================================================================

// ESモジュール環境で __dirname を再現するためのスマートな記述
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = path.join(__dirname, 'snapshot_src.txt');

// 💡 旦那様からの追加要求：ルート直下の必須構成ファイル
const ROOT_FILES = ['package.json', 'vite.config.ts', 'README.md'];

// 対象拡張子と除外ディレクトリの定義
const TARGET_EXTENSIONS = ['.ts', '.tsx', '.css', '.html', '.json'];
const EXCLUDE_DIRS = ['node_modules', 'dist'];

// 出力ファイルの初期化（既存があれば上書きクリア）
fs.writeFileSync(OUTPUT_FILE, '');

/**
 * ディレクトリを再帰的に探索する執事
 */
function walkSync(currentDirPath, callback) {
  const dirents = fs.readdirSync(currentDirPath, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(currentDirPath, dirent.name);

    if (dirent.isDirectory()) {
      // 不要なディレクトリは探索前に弾きます
      if (!EXCLUDE_DIRS.includes(dirent.name)) {
        walkSync(fullPath, callback);
      }
    } else if (dirent.isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      if (TARGET_EXTENSIONS.includes(ext)) {
        callback(fullPath);
      }
    }
  }
}

/**
 * バイトレベルでの絶対結合を実行するメソッド
 */
function appendFileToSnapshot(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`\x1b[33m[警告] 指定されたファイルが見つかりません: ${filePath}\x1b[0m`);
    return;
  }

  // 1. ヘッダーと改行は安全なUTF-8のBufferとして生成
  const headerBuffer = Buffer.from(`===== ${filePath} =====\n`, 'utf-8');
  const footerBuffer = Buffer.from('\n\n', 'utf-8');

  // 2. ★核心部★: エンコードを指定せず、ファイルを純粋なバイト列（Buffer）として読み込む
  const fileBuffer = fs.readFileSync(filePath);

  // 3. Stringへのパースを一切行わず、Bufferのまま出力ストリームへ叩き込む
  fs.appendFileSync(OUTPUT_FILE, headerBuffer);
  fs.appendFileSync(OUTPUT_FILE, fileBuffer);
  fs.appendFileSync(OUTPUT_FILE, footerBuffer);
}

// ============================================================================
// 実行フェーズ
// ============================================================================
try {
  // 1. まずはご指定のルート直下ファイル群を確実に取り込みます
  for (const fileName of ROOT_FILES) {
    const filePath = path.join(__dirname, fileName);
    appendFileToSnapshot(filePath);
  }

  // 2. 続いて、srcディレクトリの再帰的探索へ移行します
  walkSync(TARGET_DIR, (filePath) => {
    appendFileToSnapshot(filePath);
  });

  console.log('\x1b[36m%s\x1b[0m', '旦那様、ルートファイルを含めた一切の欠損がない完全無欠のスナップショットが生成されました。');
} catch (error) {
  console.error('申し訳ございません旦那様、処理中に想定外のエラーが発生いたしました:', error);
}