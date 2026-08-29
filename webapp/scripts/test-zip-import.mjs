import assert from 'node:assert/strict';
import JSZip from 'jszip';

const IMAGE_RE=/\.(jpe?g|png|webp|heic|heif|gif|avif)$/i;
const source=new JSZip();
source.file('IMG_0001.JPG',Buffer.from([0xff,0xd8,0xff,0xd9]));
source.file('subpasta/IMG_0002.heic',Buffer.from([1,2,3,4,5]));
source.file('subpasta/foto.png',Buffer.from([0x89,0x50,0x4e,0x47]));
source.file('ignorar.txt','nao e imagem');
source.file('__MACOSX/._IMG_0001.JPG',Buffer.from([9]));

const archive=await source.generateAsync({type:'nodebuffer'});
const zip=await JSZip.loadAsync(archive);
const entries=Object.values(zip.files).filter(e=>!e.dir&&IMAGE_RE.test(e.name)&&!e.name.startsWith('__MACOSX/')&&!e.name.split('/').pop()?.startsWith('._'));
const names=entries.map(e=>e.name).sort();
assert.deepEqual(names,['IMG_0001.JPG','subpasta/IMG_0002.heic','subpasta/foto.png']);
for(const entry of entries){const data=await entry.async('nodebuffer');assert.ok(data.length>0,`${entry.name} deveria ser extraível`)}
console.log(`ZIP regression OK: ${entries.length} imagens, arquivo não-imagem ignorado, metadados do macOS ignorados.`);
