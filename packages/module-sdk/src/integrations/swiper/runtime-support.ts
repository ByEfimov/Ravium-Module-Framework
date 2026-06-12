import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SwiperCarouselRuntimeSupportFile extends Record<string, unknown> {
  path: string;
  content: string;
}

const runtimeSupportFileNames = ['defaults.js', 'options.js', 'slides.js', 'types.js', 'vue.js'];

const runtimeDir = (): string => dirname(fileURLToPath(import.meta.url));

export const createSwiperCarouselRuntimeSupportFiles = (
  basePath = 'src/components/ravium-swiper',
): SwiperCarouselRuntimeSupportFile[] =>
  runtimeSupportFileNames.map((fileName) => ({
    path: `${basePath}/${fileName}`,
    content: readFileSync(join(runtimeDir(), fileName), 'utf8'),
  }));
