import type { SlideConfig } from './types.js';

export const defaultSlides: SlideConfig[] = [{ type: 'image', caption: 'Add slides in component settings' }];

export const resolveImageSource = (slide: SlideConfig): string => {
  const raw = slide.image || slide.imageUrl || slide.src || (slide.imageAssetId ? `/assets/${slide.imageAssetId}` : '');
  if (!raw.trim().startsWith('{')) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw) as { full?: { url?: string }; small?: { url?: string } };
    return parsed.full?.url || parsed.small?.url || raw;
  } catch {
    return raw;
  }
};

export const slotNamePart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const componentSlotName = (slide: SlideConfig, index: number): string => {
  if (slide.slotName) {
    return slide.slotName;
  }
  const base = slide.id || `slide-${index + 1}`;
  return `ravium-slot-${slotNamePart(base) || 'slide'}`;
};
