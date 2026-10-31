// Prepara a foto de perfil no aparelho, antes de enviar.

export const AVATAR_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 512;

export type PreparedAvatar = { blob: Blob; filename: string; note: string };

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui ler essa imagem. Tenta outra."));
    };
    img.src = url;
  });
}

export async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  if (!AVATAR_TYPES.split(",").includes(file.type)) throw new Error("Use uma imagem PNG, JPG, WebP ou GIF.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Essa imagem passa de 4 MB.");

  const img = await loadImage(file);
  const { naturalWidth: width, naturalHeight: height } = img;
  const fits = Math.max(width, height) <= MAX_SIDE;
  // canvas só desenha o primeiro quadro: GIF que já cabe vai como está, para continuar animado
  if (file.type === "image/gif" && fits) return { blob: file, filename: file.name, note: "" };

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  // redesenhar também tira os metadados da foto (como a localização)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Não consegui preparar essa imagem. Tenta outra.");
  return {
    blob,
    // navegador sem WebP devolve PNG
    filename: blob.type === "image/webp" ? "avatar.webp" : "avatar.png",
    note: file.type === "image/gif" ? `GIF maior que ${MAX_SIDE}px vira imagem parada. Para manter a animação, use um menor.` : "",
  };
}
