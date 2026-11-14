export async function compressPlayerPhoto(file) {
  const maxBytes = 50_000;
  if (file.size <= maxBytes) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    for (const size of [640, 480, 320, 240, 160, 96]) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.65, 0.45]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob?.size && blob.size <= maxBytes) {
          return new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        }
      }
    }
    throw new Error('This photo could not be reduced to 50 KB. Try another image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
