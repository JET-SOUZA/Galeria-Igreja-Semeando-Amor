declare module 'heic-to/csp' {
  export function heicTo(options: {
    blob: Blob;
    type: 'image/jpeg' | 'image/png';
    quality?: number;
  }): Promise<Blob>;
}
