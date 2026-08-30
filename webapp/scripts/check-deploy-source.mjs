import {readFile, access} from 'node:fs/promises';

const requiredFiles = [
  'app/admin/evento/[slug]/fotos/page.tsx',
  'app/admin/login/page.tsx',
  'app/admin/page.tsx',
  'app/api/icloud-worker/route.ts',
  'app/brand.ts',
  'app/cadastro/page.tsx',
  'app/evento/[slug]/page.tsx',
  'app/layout.tsx',
  'app/page.tsx',
  'app/privacidade/page.tsx',
  'app/styles.css',
  'lib/sb.ts',
  'package.json',
  'vercel.json',
];

for (const file of requiredFiles) {
  await access(file);
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.scripts?.build !== 'next build') {
  throw new Error('Deploy bloqueado: build deve ser diretamente "next build", sem bootstrap remoto.');
}
if (JSON.stringify(pkg.scripts || {}).includes('fetch-app')) {
  throw new Error('Deploy bloqueado: fetch-app não pode participar do build controlado pelo repositório.');
}
if (pkg.engines?.node !== '22.x') {
  throw new Error('Deploy bloqueado: Node deve permanecer fixado em 22.x até nova validação.');
}
for (const dep of ['next', 'react', 'react-dom', 'jszip', 'puppeteer-core', '@sparticuz/chromium-min']) {
  if (!pkg.dependencies?.[dep]) throw new Error(`Dependência obrigatória ausente: ${dep}`);
}

const worker = await readFile('app/api/icloud-worker/route.ts', 'utf8');
if (!worker.includes("export const maxDuration=300")) {
  throw new Error('Worker iCloud sem maxDuration validado.');
}
if (!worker.includes('resOriginalRes')) {
  throw new Error('Worker iCloud não contém a seleção segura por resOriginalRes.');
}

console.log(`Deploy source OK: ${requiredFiles.length} arquivos críticos presentes, build direto e dependências validadas.`);
