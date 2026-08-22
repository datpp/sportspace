// Ảnh cụm sân được trình duyệt tải trực tiếp từ route static file của backend
// (không phải gọi API JSON) nên đây là biến env public duy nhất, khác với
// BACKEND_API_URL vốn chỉ dùng ở server.
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:3000';
  return `${base}${path}`;
}
