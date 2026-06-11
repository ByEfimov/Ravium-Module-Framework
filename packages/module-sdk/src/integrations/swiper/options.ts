import {
  A11y,
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCreative,
  EffectCube,
  EffectFade,
  EffectFlip,
  FreeMode,
  Grid,
  HashNavigation,
  History,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
  Parallax,
  Scrollbar,
  Virtual,
  Zoom,
} from 'swiper/modules';
import { computed } from 'vue';
import { defaultSlides } from './slides.js';
import type { SwiperCarouselProps, SwiperEffect } from './types.js';

const SWIPER_EFFECTS: SwiperEffect[] = ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'];

const boundedNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
};

const boundedInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  return Math.round(boundedNumber(value, fallback, min, max));
};

export const useSwiperCarouselOptions = (props: Required<SwiperCarouselProps>) => {
  const normalizedSlidesPerView = computed(() => boundedInteger(props.slidesPerView, 1, 1, 8));
  const normalizedSlidesPerGroup = computed(() => boundedInteger(props.slidesPerGroup, 1, 1, 8));
  const normalizedSpaceBetween = computed(() => boundedInteger(props.spaceBetween, 0, 0, 160));
  const normalizedSpeed = computed(() => boundedInteger(props.speed, 0, 0, 10000));
  const normalizedSlides = computed(() => (props.slides.length > 0 ? props.slides : defaultSlides));
  const hasComponentSlides = computed(() => normalizedSlides.value.some((slide) => slide.type === 'component'));
  const normalizedEffect = computed<SwiperEffect>(() => {
    if (props.cssMode || props.direction === 'vertical') {
      return 'slide';
    }
    return SWIPER_EFFECTS.includes(props.effect) ? props.effect : 'slide';
  });

  const paginationConfig = computed(() =>
    props.paginationEnabled ? { clickable: props.paginationClickable, type: props.paginationType } : false,
  );
  const navigationConfig = computed(() =>
    props.navigationEnabled ? { hideOnClick: props.navigationHideOnClick } : false,
  );
  const scrollbarConfig = computed(() =>
    props.scrollbarEnabled
      ? {
          draggable: props.scrollbarDraggable,
          hide: props.scrollbarHide,
          snapOnRelease: props.scrollbarSnapOnRelease,
        }
      : false,
  );
  const autoplayConfig = computed(() => {
    const delay = boundedInteger(props.autoplayDelayMs, 0, 0, 60000);
    return delay > 0
      ? {
          delay,
          disableOnInteraction: props.autoplayDisableOnInteraction,
          pauseOnMouseEnter: props.autoplayPauseOnMouseEnter,
          reverseDirection: props.autoplayReverseDirection,
          stopOnLastSlide: props.autoplayStopOnLastSlide,
        }
      : false;
  });
  const loopConfig = computed(
    () =>
      props.loopEnabled &&
      !hasComponentSlides.value &&
      normalizedSlides.value.length > normalizedSlidesPerView.value &&
      normalizedEffect.value !== 'fade',
  );
  const rewindConfig = computed(() => props.rewindEnabled && !loopConfig.value);
  const freeModeConfig = computed(() =>
    props.freeModeEnabled
      ? {
          enabled: true,
          momentum: props.freeModeMomentum,
          momentumRatio: boundedNumber(props.freeModeMomentumRatio, 1, 0, 5),
          sticky: props.freeModeSticky,
        }
      : false,
  );
  const mousewheelConfig = computed(() =>
    props.mousewheelEnabled
      ? {
          enabled: true,
          forceToAxis: props.mousewheelForceToAxis,
          invert: props.mousewheelInvert,
          sensitivity: boundedNumber(props.mousewheelSensitivity, 1, 0.1, 10),
        }
      : false,
  );
  const keyboardConfig = computed(() =>
    props.keyboardEnabled
      ? { enabled: true, onlyInViewport: props.keyboardOnlyInViewport, pageUpDown: props.keyboardPageUpDown }
      : false,
  );
  const a11yConfig = computed(() => (props.a11yEnabled ? { enabled: true } : false));
  const zoomConfig = computed(() => {
    if (!props.zoomEnabled) {
      return false;
    }
    const minRatio = boundedNumber(props.zoomMinRatio, 1, 1, 10);
    return {
      maxRatio: Math.max(minRatio, boundedNumber(props.zoomMaxRatio, 3, 1, 10)),
      minRatio,
      toggle: props.zoomToggle,
    };
  });
  const virtualConfig = computed(() => props.virtualEnabled);
  const hashNavigationConfig = computed(() =>
    props.hashNavigationEnabled
      ? { watchState: props.hashNavigationWatchState, replaceState: props.hashNavigationReplaceState }
      : false,
  );
  const historyConfig = computed(() =>
    props.historyEnabled
      ? {
          enabled: true,
          key: props.historyKey || 'slides',
          replaceState: props.historyReplaceState,
          keepQuery: props.historyKeepQuery,
        }
      : false,
  );
  const gridConfig = computed(() => ({
    rows: normalizedEffect.value === 'slide' ? boundedInteger(props.gridRows, 1, 1, 4) : 1,
    fill: 'row' as const,
  }));

  const modules = computed(() => {
    const active = [];
    if (autoplayConfig.value) {
      active.push(Autoplay);
    }
    if (paginationConfig.value) {
      active.push(Pagination);
    }
    if (navigationConfig.value) {
      active.push(Navigation);
    }
    if (scrollbarConfig.value) {
      active.push(Scrollbar);
    }
    if (freeModeConfig.value) {
      active.push(FreeMode);
    }
    if (mousewheelConfig.value) {
      active.push(Mousewheel);
    }
    if (keyboardConfig.value) {
      active.push(Keyboard);
    }
    if (a11yConfig.value) {
      active.push(A11y);
    }
    if (zoomConfig.value) {
      active.push(Zoom);
    }
    if (virtualConfig.value) {
      active.push(Virtual);
    }
    if (props.parallaxEnabled) {
      active.push(Parallax);
    }
    if (hashNavigationConfig.value) {
      active.push(HashNavigation);
    }
    if (historyConfig.value) {
      active.push(History);
    }
    if (gridConfig.value.rows > 1) {
      active.push(Grid);
    }

    const effectModules = {
      fade: EffectFade,
      cube: EffectCube,
      coverflow: EffectCoverflow,
      flip: EffectFlip,
      cards: EffectCards,
      creative: EffectCreative,
    };
    const effectModule = normalizedEffect.value === 'slide' ? null : effectModules[normalizedEffect.value];
    if (effectModule) {
      active.push(effectModule);
    }
    return active;
  });

  const effectRotate = computed(() => boundedNumber(props.effectRotate, 50, 0, 360));
  const effectDepth = computed(() => boundedNumber(props.effectDepth, 100, 0, 1000));
  const effectModifier = computed(() => boundedNumber(props.effectModifier, 1, 0, 5));
  const coverflowEffectConfig = computed(() => ({
    rotate: effectRotate.value,
    depth: effectDepth.value,
    modifier: effectModifier.value,
    slideShadows: props.effectShadows,
  }));
  const cubeEffectConfig = computed(() => ({
    shadow: props.effectShadows,
    slideShadows: props.effectShadows,
    shadowOffset: 20,
    shadowScale: 0.94,
  }));
  const flipEffectConfig = computed(() => ({ slideShadows: props.effectShadows, limitRotation: true }));
  const cardsEffectConfig = computed(() => ({
    slideShadows: props.effectShadows,
    rotate: true,
    perSlideOffset: 8,
    perSlideRotate: 2,
  }));
  const creativeEffectConfig = computed(() => ({
    limitProgress: 3,
    prev: { translate: ['-120%', 0, -effectDepth.value], rotate: [0, 0, -effectRotate.value] },
    next: { translate: ['120%', 0, -effectDepth.value], rotate: [0, 0, effectRotate.value] },
  }));
  const slideStyle = computed(() => ({
    backgroundColor: props.slideBackgroundColor,
    borderColor: props.slideBorderColor,
    borderRadius: props.slideBorderRadius,
    borderStyle: props.slideBorderStyle,
    borderWidth: props.slideBorderWidth,
    padding: props.slidePadding,
  }));
  const captionStyle = computed(() => ({
    color: props.captionColor,
    fontSize: props.captionFontSize,
    fontWeight: props.captionFontWeight,
    padding: props.captionPadding,
  }));
  const imageFit = computed(() => (props.imageFit === 'contain' ? 'contain' : 'cover'));

  return {
    a11yConfig,
    autoplayConfig,
    cardsEffectConfig,
    captionStyle,
    coverflowEffectConfig,
    creativeEffectConfig,
    cubeEffectConfig,
    flipEffectConfig,
    freeModeConfig,
    gridConfig,
    hashNavigationConfig,
    historyConfig,
    imageFit,
    keyboardConfig,
    loopConfig,
    modules,
    mousewheelConfig,
    navigationConfig,
    normalizedEffect,
    normalizedSlides,
    normalizedSlidesPerGroup,
    normalizedSlidesPerView,
    normalizedSpaceBetween,
    normalizedSpeed,
    paginationConfig,
    rewindConfig,
    scrollbarConfig,
    slideStyle,
    virtualConfig,
    zoomConfig,
  };
};
