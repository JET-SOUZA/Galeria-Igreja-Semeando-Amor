const HEIC_EXT = /\.(heic|heif)$/i;
const HEIC_MIME = /image\/(heic|heif)/i;
const HEIC_BRANDS = new Set(['mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx']);

async function hasHeicSignature(file: Blob) {
  try {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (header.length < 12) return false;
    const brand = new TextDecoder().decode(header.slice(8, 12));
    return HEIC_BRANDS.has(brand);
  } catch {
    return false;
  }
}

export async function isHeicImage(file: File) {
  return HEIC_MIME.test(file.type) || HEIC_EXT.test(file.name) || hasHeicSignature(file);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(blob: Blob): Promise<{ image: HTMLImageElement; release: () => void }> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(objectUrl) });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('O navegador não conseguiu decodificar a imagem.'));
    };
    image.src = objectUrl;
  });
}

async function renderJpeg(blob: Blob, maxSide = 1280, quality = 0.84) {
  const { image, release } = await loadImage(blob);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error('A imagem não possui dimensões válidas.');

    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar a imagem para busca.'))),
        'image/jpeg',
        quality,
      );
    });
    return blobToDataUrl(jpeg);
  } finally {
    release();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

export async function prepareFaceImage(file: File, knownHeic?: boolean) {
  const heic = knownHeic ?? (await isHeicImage(file));
  if (!heic) return renderJpeg(file);

  try {
    const converter = await import('heic-to/csp');
    const converted = await converter.heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.88,
    });
    return renderJpeg(converted as Blob);
  } catch (conversionError) {
    // Safari consegue abrir alguns HEIC nativamente. Esse caminho mantém a
    // busca funcionando mesmo quando o conversor WebAssembly/worker é bloqueado.
    try {
      return await renderJpeg(file);
    } catch {
      throw conversionError;
    }
  }
}
