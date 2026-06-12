import type { RaviumModuleBuilder } from '../../framework/types.js';
import { createVueNpmComponentIntegration } from '../vue.js';
import { createSwiperCarouselRuntimeSupportFiles } from './runtime-support.js';
import { carouselSettingsSchema, editorStyleDeclarations, projectSettingsSchema } from './schema.js';

export interface SwiperCarouselIntegrationOptions {
  componentType?: string;
  label?: string;
  category?: string;
  runtimeRenderer?: string;
  editorRenderer?: string;
  runtimeSupportBasePath?: string;
  swiperVersion?: string;
  projectSettingsPage?: false | Record<string, unknown>;
  projectImages?: false | Record<string, unknown>;
}

const defaultProjectSettingsPage = {
  id: 'swiper.project-settings',
  label: 'Swiper',
  icon: 'Settings',
};

export const createSwiperCarouselIntegration = (
  ravium: RaviumModuleBuilder,
  options: SwiperCarouselIntegrationOptions = {},
): void => {
  const componentType = options.componentType || 'swiper.carousel';
  const label = options.label || 'Swiper Carousel';

  createVueNpmComponentIntegration(ravium, {
    settings: {
      project: {
        name: 'project',
        schema: projectSettingsSchema,
        page: options.projectSettingsPage === false ? undefined : options.projectSettingsPage || defaultProjectSettingsPage,
      },
      component: {
        name: 'carousel',
        schema: carouselSettingsSchema,
      },
    },
    component: {
      type: componentType,
      label,
      category: options.category || 'Media',
      runtimeRenderer: options.runtimeRenderer || 'src/components/SwiperCarousel.vue',
      editorRenderer: options.editorRenderer || 'src/editor-renderer.html',
      propsSchema: { $ref: '#/settingsSchema/carousel' },
      projectSettingsSchema: { $ref: '#/settingsSchema/project' },
      editorStyleDeclarations,
      palette: { id: componentType, label, icon: 'GalleryHorizontal' },
      rightPanel: { id: `${componentType}.settings`, title: 'Swiper carousel' },
    },
    projectImages: options.projectImages === false ? false : options.projectImages || { purpose: 'swiper-slide-images' },
    variables: [
      { key: 'swiperCarouselSlideGap', mode: 'public', type: 'string', default: '12px' },
      { key: 'swiperCarouselSlideRadius', mode: 'public', type: 'string', default: '8px' },
      { key: 'swiperCarouselSlideBorderColor', mode: 'public', type: 'string', default: '#e5e7eb' },
      { key: 'swiperCarouselCaptionColor', mode: 'public', type: 'string', default: '#374151' },
    ],
    npm: [
      { name: 'swiper', version: options.swiperVersion || '^12.2.0', target: 'runtime' },
    ],
    capabilities: {
      runtimeSupportFiles: createSwiperCarouselRuntimeSupportFiles(options.runtimeSupportBasePath),
    },
  });
};

export { carouselSettingsSchema, editorStyleDeclarations, projectSettingsSchema } from './schema.js';
