import { isEphemeralDiscordImageUrl, sanitizePublicImageUrl } from './publicImageUrl';

describe('publicImageUrl', () => {
  it('remove Discord CDN images from public payloads', () => {
    expect(sanitizePublicImageUrl('https://cdn.discordapp.com/attachments/1/image.png?ex=abc')).toBeNull();
    expect(sanitizePublicImageUrl('https://media.discordapp.net/attachments/1/Capa_RPG.png?ex=abc')).toBeNull();
  });

  it('keeps stable image URLs and local asset paths', () => {
    expect(sanitizePublicImageUrl(' https://res.cloudinary.com/demo/image/upload/banner.jpg ')).toBe(
      'https://res.cloudinary.com/demo/image/upload/banner.jpg'
    );
    expect(sanitizePublicImageUrl('/assets/banner_placeholder.webp')).toBe('/assets/banner_placeholder.webp');
  });

  it('treats empty and non-string values as no public image', () => {
    expect(sanitizePublicImageUrl('')).toBeNull();
    expect(sanitizePublicImageUrl(null)).toBeNull();
    expect(sanitizePublicImageUrl({ url: 'https://cdn.discordapp.com/image.png' })).toBeNull();
  });

  it('detects only parseable Discord CDN hosts', () => {
    expect(isEphemeralDiscordImageUrl('https://discord.com/channels/1/2/3')).toBe(false);
    expect(isEphemeralDiscordImageUrl('not a url with cdn.discordapp.com')).toBe(false);
  });
});
