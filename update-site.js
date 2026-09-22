const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============================================================
// 사진 넣는 폴더 (여기에 사진을 넣고 사진올리기.bat 을 더블클릭하세요)
// ============================================================
const PHOTO_SOURCE_DIR = 'C:\\Users\\wuenw\\Desktop\\사진';

// 사이트 폴더 (index.html 이 있는 이 파일과 같은 폴더)
const dir = __dirname;
const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const imageExts = ['.jpg', '.jpeg', '.png'];

// 사진 폴더가 없으면 만들어 줍니다.
if (!fs.existsSync(PHOTO_SOURCE_DIR)) {
  fs.mkdirSync(PHOTO_SOURCE_DIR, { recursive: true });
  console.log(`사진 폴더를 새로 만들었습니다: ${PHOTO_SOURCE_DIR}`);
  console.log('이 폴더에 사진을 넣고 사진올리기.bat 을 다시 더블클릭하세요.');
  process.exit(0);
}

console.log(`사진 폴더를 확인합니다: ${PHOTO_SOURCE_DIR}`);

const sourceFiles = fs
  .readdirSync(PHOTO_SOURCE_DIR)
  .filter((f) => imageExts.includes(path.extname(f).toLowerCase()))
  .filter((f) => fs.statSync(path.join(PHOTO_SOURCE_DIR, f)).isFile());

if (sourceFiles.length === 0) {
  console.log('사진 폴더가 비어 있습니다. 사진을 넣고 다시 실행해 주세요.');
  process.exit(0);
}

// 웹에서 안전하게 열리는 파일명으로 바꿉니다.
// (한글/공백/특수문자가 들어간 파일명은 주소에서 깨질 수 있어서 영문+숫자로 바꿉니다.)
function toWebSafeName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, path.extname(fileName));
  if (/^[A-Za-z0-9._-]+$/.test(base)) {
    return base + ext;
  }
  const hash = crypto.createHash('sha1').update(fileName).digest('hex').slice(0, 8);
  return `photo-${hash}${ext}`;
}

// 사진 "내용"의 지문(해시)입니다. 파일명이 아니라 실제 그림 내용으로 계산합니다.
// 휴대폰이 IMG_0042.jpg 같은 이름을 재사용해도, 내용이 다르면 다른 값이 나옵니다.
function contentHashOf(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 10);
}

function alreadyInHtml(webName) {
  return html.includes(`src="${webName}"`);
}

// 어떤 사진을 어떤 이름으로 올릴지 정합니다.
//  - 파일명도 내용도 이미 올라간 것과 같으면        -> 조용히 건너뜁니다 (진짜 중복)
//  - 파일명만 같고 내용이 다르면(재사용된 파일명)   -> photo-<내용해시>.jpg 로 이름을 바꿔 올립니다
//  - 같은 실행 안에서 1.JPG / 1.jpg 처럼 겹치면    -> 덮어쓰지 않도록 역시 이름을 바꿔 올립니다
const takenWebNames = new Set(); // 이번 실행에서 이미 쓴 웹 파일명
const takenContentHashes = new Set(); // 이번 실행에서 이미 올린 사진 내용
const pending = [];

for (const sourceName of sourceFiles) {
  const from = path.join(PHOTO_SOURCE_DIR, sourceName);
  const ext = path.extname(sourceName).toLowerCase();
  const contentHash = contentHashOf(from);
  let webName = toWebSafeName(sourceName);

  // 같은 실행 안에서 이미 똑같은 내용의 사진을 처리했으면 건너뜁니다. (중복 카드 방지)
  if (takenContentHashes.has(contentHash)) {
    continue;
  }

  let nameConflict = takenWebNames.has(webName);

  if (!nameConflict && alreadyInHtml(webName)) {
    const existingPath = path.join(dir, webName);
    if (fs.existsSync(existingPath) && contentHashOf(existingPath) === contentHash) {
      // 이름도 내용도 같음 = 이미 올라간 그 사진. 그대로 건너뜁니다.
      continue;
    }
    // 이름은 같은데 내용이 다름 = 휴대폰이 파일명을 재사용한 새 사진.
    nameConflict = true;
  }

  if (nameConflict) {
    const altName = `photo-${contentHash}${ext}`;
    if (takenWebNames.has(altName) || alreadyInHtml(altName)) {
      // 이 사진은 이미 다른 이름으로 올라가 있습니다.
      continue;
    }
    console.log(`기존 사진과 파일명이 같아 다른 이름으로 올립니다: ${sourceName} -> ${altName}`);
    webName = altName;
  }

  takenWebNames.add(webName);
  takenContentHashes.add(contentHash);
  pending.push({ sourceName, webName });
}

if (pending.length === 0) {
  console.log('새로 추가할 사진이 없습니다. (이미 다 올라가 있음)');
  process.exit(0);
}

// 사진 폴더에 있는 새 사진을 사이트 폴더로 복사합니다. (원본은 그대로 남습니다)
const newFiles = [];
for (const { sourceName, webName } of pending) {
  const from = path.join(PHOTO_SOURCE_DIR, sourceName);
  const to = path.join(dir, webName);

  const sizeMb = fs.statSync(from).size / (1024 * 1024);
  if (sizeMb > 3) {
    console.log(
      `주의: ${sourceName} 은 ${sizeMb.toFixed(1)}MB 로 좀 큽니다. 휴대폰에서 느리게 열릴 수 있어요.`
    );
  }

  fs.copyFileSync(from, to);
  if (sourceName !== webName) {
    console.log(`${sourceName} -> ${webName} (웹용 이름으로 복사)`);
  }
  newFiles.push(webName);
}

const cardsHtml = newFiles
  .map(
    (f) => `
      <div class="news-card">
        <img src="${f}" alt="상담 사례" style="width:100%;border-radius:12px;margin-bottom:10px;display:block;">
        <span class="news-tag">상담사례</span>
        <h3>실제 상담 사례</h3>
        <p>고객님과 나눈 사주 상담 내용 일부를 공유드립니다.</p>
      </div>
`
  )
  .join('');

const scrollOpenIdx = html.indexOf('<div class="news-scroll">');
if (scrollOpenIdx === -1) {
  console.error('index.html에서 소식 영역(news-scroll)을 찾지 못했습니다.');
  process.exit(1);
}
const afterOpen = html.slice(scrollOpenIdx);
const closeMatch = afterOpen.match(/\r?\n\s*<\/div>\r?\n\s*<\/section>/);
if (!closeMatch) {
  console.error('index.html에서 소식 영역의 닫는 부분을 찾지 못했습니다.');
  process.exit(1);
}
const closeIdx = scrollOpenIdx + closeMatch.index;

html = html.slice(0, closeIdx) + cardsHtml + html.slice(closeIdx);
fs.writeFileSync(htmlPath, html, 'utf8');

console.log(`${newFiles.length}개 사진을 소식에 추가합니다: ${newFiles.join(', ')}`);

try {
  execSync('git add -A', { cwd: dir, stdio: 'inherit' });
  execSync(`git commit -m "새 소식 사진 추가: ${newFiles.join(', ')}"`, {
    cwd: dir,
    stdio: 'inherit',
  });
  execSync('git push', { cwd: dir, stdio: 'inherit' });
  console.log('\n완료! 1~2분 후 changyeon4277.github.io 에서 확인하세요.');
} catch (e) {
  console.error('\n업로드 중 문제가 발생했습니다. 화면에 나온 내용을 캡처해서 보내주세요.');
  console.error(e.message);
}
