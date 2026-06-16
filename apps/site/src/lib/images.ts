const isCloudinaryImage = (url: string): boolean =>
  /^https:\/\/res\.cloudinary\.com\//.test(url);

export function optimizedImageUrl(url: string, width: number): string {
  if (!url) return url;
  if (isCloudinaryImage(url)) {
    return url.replace("/upload/", `/upload/f_auto,q_auto,c_fill,w_${width}/`);
  }
  return url;
}

export function responsiveSrcSet(url: string, widths = [360, 540, 720, 960]): string {
  if (!isCloudinaryImage(url)) return "";
  return widths.map((width) => `${optimizedImageUrl(url, width)} ${width}w`).join(", ");
}
