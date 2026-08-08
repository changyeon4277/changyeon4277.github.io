const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = __dirname;
const htmlPath = path.join(dir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const imageExts = ['.jpg', '.jpeg', '.png'];
const files = fs
  .readdirSync(dir)
  .filter((f) => imageExts.includes(path.extname(f).toLowerCase()));

const newFiles = files.filter((f) => !html.includes(`src="${f}"`));

if (newFiles.length === 0) {
  console.log('새로 추가할 사진이 없습니다. (이미 다 올라가 있음)');
  process.exit(0);
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
