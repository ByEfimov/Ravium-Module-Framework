import type { RaviumJSONSchema } from '../../framework/types.js';

export const projectSettingsSchema = {
  type: 'object',
  properties: {
    paginationEnabled: {
      type: 'boolean',
      title: 'Enable pagination',
      default: true,
    },
    paginationType: {
      type: 'string',
      title: 'Pagination type',
      enum: ['bullets', 'fraction', 'progressbar'],
      default: 'bullets',
    },
    paginationClickable: {
      type: 'boolean',
      title: 'Clickable pagination',
      default: true,
    },
    styleMode: {
      type: 'string',
      title: 'Styles',
      enum: ['swiper', 'ravium'],
      default: 'swiper',
      description: 'swiper uses bundled Swiper styles, ravium uses neutral Ravium defaults.',
    },
  },
} satisfies RaviumJSONSchema;

export const carouselSettingsSchema = {
  type: 'object',
  properties: {
    autoplayDelayMs: {
      type: 'number',
      title: 'Autoscroll delay',
      minimum: 0,
      maximum: 60000,
      default: 3000,
    },
    autoplayDisableOnInteraction: {
      type: 'boolean',
      title: 'Autoplay disable on interaction',
      default: false,
      'x-raviumDependsOn': {
        property: 'autoplayDelayMs',
        value: '0',
        operator: 'notEquals',
      },
    },
    autoplayPauseOnMouseEnter: {
      type: 'boolean',
      title: 'Autoplay pause on hover',
      default: true,
      'x-raviumDependsOn': {
        property: 'autoplayDelayMs',
        value: '0',
        operator: 'notEquals',
      },
    },
    autoplayReverseDirection: {
      type: 'boolean',
      title: 'Autoplay reverse direction',
      default: false,
      'x-raviumDependsOn': {
        property: 'autoplayDelayMs',
        value: '0',
        operator: 'notEquals',
      },
    },
    autoplayStopOnLastSlide: {
      type: 'boolean',
      title: 'Autoplay stop on last slide',
      default: false,
      'x-raviumDependsOn': {
        property: 'autoplayDelayMs',
        value: '0',
        operator: 'notEquals',
      },
    },
    slidesPerView: {
      type: 'number',
      title: 'Cards per view',
      minimum: 1,
      maximum: 8,
      default: 1,
    },
    slidesPerGroup: {
      type: 'number',
      title: 'Cards per scroll',
      minimum: 1,
      maximum: 8,
      default: 1,
    },
    direction: {
      type: 'string',
      title: 'Direction',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    navigationEnabled: {
      type: 'boolean',
      title: 'Navigation arrows',
      default: false,
    },
    navigationHideOnClick: {
      type: 'boolean',
      title: 'Hide navigation on click',
      default: false,
      'x-raviumDependsOn': {
        property: 'navigationEnabled',
        value: 'true',
      },
    },
    scrollbarEnabled: {
      type: 'boolean',
      title: 'Scrollbar',
      default: false,
    },
    scrollbarDraggable: {
      type: 'boolean',
      title: 'Scrollbar draggable',
      default: true,
      'x-raviumDependsOn': {
        property: 'scrollbarEnabled',
        value: 'true',
      },
    },
    scrollbarHide: {
      type: 'boolean',
      title: 'Scrollbar auto hide',
      default: false,
      'x-raviumDependsOn': {
        property: 'scrollbarEnabled',
        value: 'true',
      },
    },
    scrollbarSnapOnRelease: {
      type: 'boolean',
      title: 'Scrollbar snap on release',
      default: true,
      'x-raviumDependsOn': {
        property: 'scrollbarEnabled',
        value: 'true',
      },
    },
    loopEnabled: {
      type: 'boolean',
      title: 'Loop',
      default: true,
    },
    rewindEnabled: {
      type: 'boolean',
      title: 'Rewind',
      default: false,
    },
    centeredSlides: {
      type: 'boolean',
      title: 'Centered slides',
      default: false,
    },
    freeModeEnabled: {
      type: 'boolean',
      title: 'Free mode',
      default: false,
    },
    freeModeMomentum: {
      type: 'boolean',
      title: 'Free mode momentum',
      default: true,
      'x-raviumDependsOn': {
        property: 'freeModeEnabled',
        value: 'true',
      },
    },
    freeModeMomentumRatio: {
      type: 'number',
      title: 'Free mode momentum ratio',
      minimum: 0,
      maximum: 5,
      default: 1,
      'x-raviumDependsOn': {
        property: 'freeModeEnabled',
        value: 'true',
      },
    },
    freeModeSticky: {
      type: 'boolean',
      title: 'Free mode sticky',
      default: false,
      'x-raviumDependsOn': {
        property: 'freeModeEnabled',
        value: 'true',
      },
    },
    mousewheelEnabled: {
      type: 'boolean',
      title: 'Mousewheel',
      default: false,
    },
    mousewheelForceToAxis: {
      type: 'boolean',
      title: 'Mousewheel force to axis',
      default: false,
      'x-raviumDependsOn': {
        property: 'mousewheelEnabled',
        value: 'true',
      },
    },
    mousewheelInvert: {
      type: 'boolean',
      title: 'Mousewheel invert',
      default: false,
      'x-raviumDependsOn': {
        property: 'mousewheelEnabled',
        value: 'true',
      },
    },
    mousewheelSensitivity: {
      type: 'number',
      title: 'Mousewheel sensitivity',
      minimum: 0.1,
      maximum: 10,
      default: 1,
      'x-raviumDependsOn': {
        property: 'mousewheelEnabled',
        value: 'true',
      },
    },
    keyboardEnabled: {
      type: 'boolean',
      title: 'Keyboard',
      default: false,
    },
    keyboardOnlyInViewport: {
      type: 'boolean',
      title: 'Keyboard only in viewport',
      default: true,
      'x-raviumDependsOn': {
        property: 'keyboardEnabled',
        value: 'true',
      },
    },
    keyboardPageUpDown: {
      type: 'boolean',
      title: 'Keyboard PageUp/PageDown',
      default: true,
      'x-raviumDependsOn': {
        property: 'keyboardEnabled',
        value: 'true',
      },
    },
    a11yEnabled: {
      type: 'boolean',
      title: 'Accessibility',
      default: true,
    },
    zoomEnabled: {
      type: 'boolean',
      title: 'Zoom',
      default: false,
    },
    zoomMaxRatio: {
      type: 'number',
      title: 'Zoom max ratio',
      minimum: 1,
      maximum: 10,
      default: 3,
      'x-raviumDependsOn': {
        property: 'zoomEnabled',
        value: 'true',
      },
    },
    zoomMinRatio: {
      type: 'number',
      title: 'Zoom min ratio',
      minimum: 1,
      maximum: 10,
      default: 1,
      'x-raviumDependsOn': {
        property: 'zoomEnabled',
        value: 'true',
      },
    },
    zoomToggle: {
      type: 'boolean',
      title: 'Zoom double tap toggle',
      default: true,
      'x-raviumDependsOn': {
        property: 'zoomEnabled',
        value: 'true',
      },
    },
    virtualEnabled: {
      type: 'boolean',
      title: 'Virtual slides',
      default: false,
    },
    parallaxEnabled: {
      type: 'boolean',
      title: 'Parallax',
      default: false,
    },
    parallaxOffset: {
      type: 'string',
      title: 'Parallax offset',
      default: '-18%',
    },
    hashNavigationEnabled: {
      type: 'boolean',
      title: 'Hash navigation',
      default: false,
    },
    hashNavigationWatchState: {
      type: 'boolean',
      title: 'Hash watch state',
      default: true,
      'x-raviumDependsOn': {
        property: 'hashNavigationEnabled',
        value: 'true',
      },
    },
    hashNavigationReplaceState: {
      type: 'boolean',
      title: 'Hash replace state',
      default: false,
      'x-raviumDependsOn': {
        property: 'hashNavigationEnabled',
        value: 'true',
      },
    },
    historyEnabled: {
      type: 'boolean',
      title: 'History navigation',
      default: false,
    },
    historyKey: {
      type: 'string',
      title: 'History key',
      default: 'slides',
      'x-raviumDependsOn': {
        property: 'historyEnabled',
        value: 'true',
      },
    },
    historyReplaceState: {
      type: 'boolean',
      title: 'History replace state',
      default: false,
      'x-raviumDependsOn': {
        property: 'historyEnabled',
        value: 'true',
      },
    },
    historyKeepQuery: {
      type: 'boolean',
      title: 'History keep query',
      default: false,
      'x-raviumDependsOn': {
        property: 'historyEnabled',
        value: 'true',
      },
    },
    effect: {
      type: 'string',
      title: 'Effect',
      enum: ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'],
      default: 'slide',
    },
    effectRotate: {
      type: 'number',
      title: 'Effect rotate',
      minimum: 0,
      maximum: 360,
      default: 50,
      'x-raviumDependsOn': {
        property: 'effect',
        value: ['cube', 'coverflow', 'flip', 'cards', 'creative'],
        operator: 'in',
      },
    },
    effectDepth: {
      type: 'number',
      title: 'Effect depth',
      minimum: 0,
      maximum: 1000,
      default: 100,
      'x-raviumDependsOn': {
        property: 'effect',
        value: ['cube', 'coverflow', 'creative'],
        operator: 'in',
      },
    },
    effectModifier: {
      type: 'number',
      title: 'Effect modifier',
      minimum: 0,
      maximum: 5,
      default: 1,
      'x-raviumDependsOn': {
        property: 'effect',
        value: ['coverflow', 'creative'],
        operator: 'in',
      },
    },
    effectShadows: {
      type: 'boolean',
      title: 'Effect shadows',
      default: true,
      'x-raviumDependsOn': {
        property: 'effect',
        value: ['cube', 'coverflow', 'flip', 'cards'],
        operator: 'in',
      },
    },
    speed: {
      type: 'number',
      title: 'Speed',
      minimum: 0,
      maximum: 10000,
      default: 420,
    },
    autoHeight: {
      type: 'boolean',
      title: 'Auto height',
      default: false,
    },
    grabCursor: {
      type: 'boolean',
      title: 'Grab cursor',
      default: false,
    },
    cssMode: {
      type: 'boolean',
      title: 'CSS mode',
      default: false,
    },
    gridRows: {
      type: 'number',
      title: 'Grid rows',
      minimum: 1,
      maximum: 4,
      default: 1,
    },
    allowTouchMove: {
      type: 'boolean',
      title: 'Touch drag',
      default: true,
    },
    simulateTouch: {
      type: 'boolean',
      title: 'Simulate touch',
      default: true,
    },
    touchRatio: {
      type: 'number',
      title: 'Touch ratio',
      minimum: 0,
      maximum: 5,
      default: 1,
    },
    touchAngle: {
      type: 'number',
      title: 'Touch angle',
      minimum: 0,
      maximum: 90,
      default: 45,
    },
    threshold: {
      type: 'number',
      title: 'Swipe threshold',
      minimum: 0,
      maximum: 100,
      default: 5,
    },
    slides: {
      type: 'array',
      title: 'Slides',
      'x-raviumInput': 'slides',
      default: [],
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['image', 'component'],
            default: 'image',
          },
          image: {
            type: 'string',
            title: 'Uploaded image',
          },
          imageAssetId: {
            type: 'string',
            title: 'Uploaded image id',
          },
          imageUrl: {
            type: 'string',
            title: 'Image URL',
          },
          alt: {
            type: 'string',
            title: 'Alt text',
          },
          componentId: {
            type: 'string',
            title: 'Ravium component id',
          },
          componentName: {
            type: 'string',
            title: 'Component name',
          },
          componentProps: {
            type: 'object',
            title: 'Component props',
            default: {},
          },
          caption: {
            type: 'string',
            title: 'Caption',
          },
        },
      },
    },
    spaceBetween: {
      type: 'number',
      title: 'Slide gap',
      minimum: 0,
      maximum: 80,
      default: 16,
    },
    slideBackgroundColor: {
      type: 'string',
      title: 'Slide background',
      format: 'color',
      default: '#ffffff',
    },
    slideBorderRadius: {
      type: 'string',
      title: 'Slide radius',
      default: '8px',
    },
    slideBorderWidth: {
      type: 'string',
      title: 'Slide border width',
      default: '1px',
    },
    slideBorderStyle: {
      type: 'string',
      title: 'Slide border style',
      enum: ['none', 'solid', 'dashed', 'dotted'],
      default: 'solid',
    },
    slideBorderColor: {
      type: 'string',
      title: 'Slide border',
      format: 'color',
      default: '#e5e7eb',
    },
    slidePadding: {
      type: 'string',
      title: 'Slide padding',
      default: '0px',
    },
    captionColor: {
      type: 'string',
      title: 'Caption color',
      format: 'color',
      default: '#374151',
    },
    captionPadding: {
      type: 'string',
      title: 'Caption padding',
      default: '10px',
    },
    captionFontSize: {
      type: 'string',
      title: 'Caption font size',
      default: '14px',
    },
    captionFontWeight: {
      type: 'string',
      title: 'Caption font weight',
      enum: ['400', '500', '600', '700'],
      default: '400',
    },
    imageFit: {
      type: 'string',
      title: 'Image fit',
      enum: ['cover', 'contain'],
      default: 'cover',
    },
  },
} satisfies RaviumJSONSchema;

export const editorStyleDeclarations = [
  {
    label: 'Слайды: расстояние',
    inputs: [
      {
        prop: 'spaceBetween',
        type: 'number',
        units: ['px'],
        min: 0,
        max: 80,
        step: 1,
        defaultValue: '16px',
        showIncrementButtons: true,
      },
    ],
  },
  {
    label: 'Слайд: фон',
    inputs: [
      {
        prop: 'slideBackgroundColor',
        type: 'color',
        defaultValue: '#ffffff',
      },
    ],
  },
  {
    label: 'Слайд: радиус',
    inputs: [
      {
        prop: 'slideBorderRadius',
        type: 'number',
        units: ['px', '%'],
        min: 0,
        max: 80,
        step: 1,
        defaultValue: '8px',
        showIncrementButtons: true,
      },
    ],
  },
  {
    label: 'Слайд: граница',
    inputs: [
      {
        prop: 'slideBorderColor',
        type: 'color',
        defaultValue: '#e5e7eb',
      },
      {
        prop: 'slideBorderWidth',
        type: 'number',
        units: ['px'],
        min: 0,
        max: 16,
        step: 1,
        defaultValue: '1px',
        showIncrementButtons: true,
      },
      {
        prop: 'slideBorderStyle',
        type: 'select',
        options: [
          {
            value: 'none',
            label: 'None',
          },
          {
            value: 'solid',
            label: 'Solid',
          },
          {
            value: 'dashed',
            label: 'Dashed',
          },
          {
            value: 'dotted',
            label: 'Dotted',
          },
        ],
        defaultValue: 'solid',
      },
    ],
  },
  {
    label: 'Слайд: отступ',
    inputs: [
      {
        prop: 'slidePadding',
        type: 'number',
        units: ['px'],
        min: 0,
        max: 80,
        step: 1,
        defaultValue: '0px',
        showIncrementButtons: true,
      },
    ],
  },
  {
    label: 'Подпись: текст',
    inputs: [
      {
        prop: 'captionColor',
        type: 'color',
        defaultValue: '#374151',
      },
      {
        prop: 'captionFontSize',
        type: 'number',
        units: ['px'],
        min: 10,
        max: 32,
        step: 1,
        defaultValue: '14px',
        showIncrementButtons: true,
      },
      {
        prop: 'captionFontWeight',
        type: 'select',
        options: [
          {
            value: '400',
            label: 'Regular',
          },
          {
            value: '500',
            label: 'Medium',
          },
          {
            value: '600',
            label: 'Semi Bold',
          },
          {
            value: '700',
            label: 'Bold',
          },
        ],
        defaultValue: '400',
      },
    ],
  },
  {
    label: 'Подпись: отступ',
    inputs: [
      {
        prop: 'captionPadding',
        type: 'number',
        units: ['px'],
        min: 0,
        max: 48,
        step: 1,
        defaultValue: '10px',
        showIncrementButtons: true,
      },
    ],
  },
  {
    label: 'Картинка',
    inputs: [
      {
        prop: 'imageFit',
        type: 'select',
        options: [
          {
            value: 'cover',
            label: 'Cover',
          },
          {
            value: 'contain',
            label: 'Contain',
          },
        ],
        defaultValue: 'cover',
      },
    ],
  },
];
