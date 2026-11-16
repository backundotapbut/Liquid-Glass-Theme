(function () {
    'use strict';

    // Имя должно совпадать с metadata.json: по нему PulseSync отдаёт настройки.
    const ADDON_NAME = 'LiquidGlassTheme [W.I.P]';

    const DEFAULTS = {
        // Стекло
        glassEnabled: true,
        liquidGlass: true,
        glassSaturation: 180,
        blurBase: 4,
        blurPanels: 8,
        tooltipGlass: true,
        blurTooltip: 4,
        tooltipBgOpacity: 5,
        playerBgOpacity: 40,
        popoverBgOpacity: 35,
        buttonBgOpacity: 35,
        // Интеграция с CoverDownloader
        coverDownloadGlass: true,
        coverDownloadBgOpacity: 35,
        coverDownloadHoverBgOpacity: 60,
        fullscreenGlassEnabled: true,
        popupGlassEnabled: true,
        // Стекло плеера «Моя волна»
        vibeGlassEnabled: true,
        progressGlassEnabled: true,
        progressBgOpacity: 35,
        controlsGlassEnabled: true,
        controlsBgOpacity: 35,
        explicitMarkGlass: true,
        explicitTooltipOpacity: 45,
        // Интеграции
        tovibeGlass: true,
        tovibeBgOpacity: 35,
        tovibeCompact: false,
        // Анимации
        fullscreenAnimations: true,
        coverAnimations: true,
        fullscreenSmoothBg: true,
        fullscreenAnimationDuration: 300,
        animationEnabled: true,
        animationScale: 1.5,
        animationLeftOffset: 0,
        animationTopOffset: 30,
        // «Моя волна»
        waveLayoutEnabled: true,
        playerWidth: 100,
        coverOffsetX: 0,
        hideVibeBanner: true,
        hideVibeArtist: true,
        // Интерфейс
        sidebarStyle: 'standard',
        hideFooter: true
    };

    const SIDEBAR_STYLES = ['standard', 'transparent', 'glass'];

    let currentSettings = {};
    let settingsApi = null;

    // ─────────────────────────────────────────────────────────────
    // Общие помощники
    // ─────────────────────────────────────────────────────────────

    function unwrapSetting(entry, fallback) {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            if (typeof entry.value !== 'undefined') return entry.value;
            if (typeof entry.default !== 'undefined') return entry.default;
        }
        return typeof entry !== 'undefined' ? entry : fallback;
    }

    function readSetting(settings, key) {
        return unwrapSetting(settings ? settings[key] : undefined, DEFAULTS[key]);
    }

    // Селектор боковой панели в разных версиях PulseSync может приходить
    // строкой, объектом { value } / { selected } или числовым индексом.
    // Приводим всё к одному из трёх известных значений.
    function normalizeSidebarStyle(raw) {
        let value = raw;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (typeof value.value !== 'undefined') value = value.value;
            else if (typeof value.selected !== 'undefined') value = value.selected;
            else if (typeof value.default !== 'undefined') value = value.default;
            else if (typeof value.defaultValue !== 'undefined') value = value.defaultValue;
        }
        const text = String(value == null ? '' : value).trim().toLowerCase();
        if (SIDEBAR_STYLES.includes(text)) return text;
        const index = Number(text);
        if (Number.isInteger(index) && index >= 1 && index <= SIDEBAR_STYLES.length) {
            return SIDEBAR_STYLES[index - 1];
        }
        return 'standard';
    }

    function readNumber(settings, key) {
        const value = Number(readSetting(settings, key));
        return Number.isFinite(value) ? value : DEFAULTS[key];
    }

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function setRootVar(name, value) {
        document.documentElement.style.setProperty(name, value);
    }

    // Фильтр стекла: SVG-искажение + насыщенность + размытие.
    // Крупные поверхности используют плоское размытие (buildOverlayFilter).
    function buildGlassEnhance(settings) {
        const saturation = clampNumber(Math.round(readNumber(settings, 'glassSaturation')), 0, 300);
        const brightness = 105; // яркость стекла: константа (настройка не выставлена в схеме)
        return 'saturate(' + saturation + '%) brightness(' + (brightness / 100) + ')';
    }

    function buildFilter(blurPx, liquidGlass, settings) {
        const px = clampNumber(Math.round(Number(blurPx) || 0), 0, 60);
        const prefix = liquidGlass ? 'url(#liquidGlassFilter) ' : '';
        return prefix + buildGlassEnhance(settings) + ' blur(' + px + 'px)';
    }

    // Крупные модальные поверхности (полноэкранный плеер, диалоги, просмотр
    // обложки) не должны ни искажать, ни перекрашивать фон за собой:
    // оставляем только обычное размытие без saturate/brightness.
    function buildOverlayFilter(blurPx) {
        const px = clampNumber(Math.round(Number(blurPx) || 0), 0, 60);
        return 'blur(' + px + 'px)';
    }

    // ─────────────────────────────────────────────────────────────
    // Жидкое стекло: SVG-фильтр, на который ссылается style.css
    // ─────────────────────────────────────────────────────────────

    function addLiquidGlass() {
        if (document.getElementById('liquidGlassFilter')) return;

        const liquidGlassFilter = document.createElement('svg');
        liquidGlassFilter.innerHTML = `<svg style="display: none">
                            <filter id="liquidGlassFilter">
                                <feImage href="data:image/png;base64,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" preserveAspectRatio="none"/>
                                <feDisplacementMap
                                        in="SourceGraphic"
                                        in2="turbulence"
                                        scale="600"
                                        xChannelSelector="R"
                                        yChannelSelector="G"
                                />
                            </filter>
                        </svg>`;
        document.body.appendChild(liquidGlassFilter.firstChild);
    }

    // ─────────────────────────────────────────────────────────────
    // Тема: переменные CSS и классы-переключатели
    // ─────────────────────────────────────────────────────────────

    function applyThemeSettings(settings) {
        const glassEnabled = !!readSetting(settings, 'glassEnabled');
        const liquidGlass = !!readSetting(settings, 'liquidGlass');
        const tooltipGlass = !!readSetting(settings, 'tooltipGlass');
        const fullscreenGlassEnabled = !!readSetting(settings, 'fullscreenGlassEnabled');
        const popupGlassEnabled = !!readSetting(settings, 'popupGlassEnabled');
        const fullscreenSmoothBg = !!readSetting(settings, 'fullscreenSmoothBg');
        const vibeGlassEnabled = !!readSetting(settings, 'vibeGlassEnabled');
        const progressGlassEnabled = !!readSetting(settings, 'progressGlassEnabled');
        const controlsGlassEnabled = !!readSetting(settings, 'controlsGlassEnabled');
        const explicitMarkGlass = !!readSetting(settings, 'explicitMarkGlass');
        const tovibeGlass = !!readSetting(settings, 'tovibeGlass');
        const tovibeCompact = !!readSetting(settings, 'tovibeCompact');
        const coverDownloadGlass = !!readSetting(settings, 'coverDownloadGlass');

        const html = document.documentElement;

        // Вид боковой панели: standard | transparent | glass.
        const normalizedSidebarStyle = normalizeSidebarStyle(readSetting(settings, 'sidebarStyle'));
        SIDEBAR_STYLES.forEach((style) => {
            html.classList.toggle(`ps-sidebar-${style}`, normalizedSidebarStyle === style);
        });

        html.classList.toggle('ps-glass', glassEnabled);
        html.classList.toggle('ps-tooltip-glass', glassEnabled && tooltipGlass);
        html.classList.toggle('ps-fullscreen-glass', glassEnabled && fullscreenGlassEnabled);
        html.classList.toggle('ps-popup-glass', glassEnabled && popupGlassEnabled);
        html.classList.toggle('ps-fullscreen-smooth-bg', fullscreenSmoothBg);
        html.classList.toggle('ps-hide-footer', !!readSetting(settings, 'hideFooter'));
        html.classList.toggle('ps-wave-layout', !!readSetting(settings, 'waveLayoutEnabled'));
        html.classList.toggle('ps-hide-vibe-artist', !!readSetting(settings, 'hideVibeArtist'));

        // Стекло плеера «Моя волна»: общий выключатель и отдельные группы.
        const vibeGlass = glassEnabled && vibeGlassEnabled;
        html.classList.toggle('ps-vibe-glass', vibeGlass);
        html.classList.toggle('ps-progress-glass', vibeGlass && progressGlassEnabled);
        html.classList.toggle('ps-controls-glass', vibeGlass && controlsGlassEnabled);
        html.classList.toggle('ps-explicit-glass', vibeGlass && explicitMarkGlass);

        // Интеграция с ToVibe.
        html.classList.toggle('ps-tovibe-glass', glassEnabled && tovibeGlass);
        html.classList.toggle('ps-tovibe-compact', tovibeCompact);

        // Интеграция с CoverDownloader: стеклянная кнопка скачивания обложки.
        html.classList.toggle('ps-cover-download-glass', glassEnabled && coverDownloadGlass);

        setRootVar('--ps-filter-base', buildFilter(readNumber(settings, 'blurBase'), liquidGlass, settings));
        setRootVar('--ps-filter-panel', buildFilter(readNumber(settings, 'blurPanels'), liquidGlass, settings));
        // Полноэкранный плеер — исключение: без SVG-искажения
        // и без усиления насыщенности, чтобы фон не выгибался
        // и не менял цвет при открытии.
        setRootVar('--ps-filter-fullscreen', buildOverlayFilter(readNumber(settings, 'blurPanels')));
        // Карточка трека, просмотр обложки и другие диалоги — тоже
        // исключение: только обычное размытие.
        setRootVar('--ps-filter-popup', buildOverlayFilter(readNumber(settings, 'blurPanels')));
        setRootVar('--ps-filter-tooltip', buildFilter(readNumber(settings, 'blurTooltip'), liquidGlass, settings));
        // Стеклянная боковая панель: размытие сильнее, чем у обычных панелей,
        // но с той же настраиваемой насыщенностью.
        setRootVar('--ps-sidebar-filter', buildFilter(18, false, settings));

        setRootVar('--ps-tooltip-bg-opacity', clampNumber(readNumber(settings, 'tooltipBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-player-bg-opacity', clampNumber(readNumber(settings, 'playerBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-popover-bg-opacity', clampNumber(readNumber(settings, 'popoverBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-button-bg-opacity', clampNumber(readNumber(settings, 'buttonBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-cover-download-bg-opacity', clampNumber(readNumber(settings, 'coverDownloadBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-cover-download-hover-bg-opacity', clampNumber(readNumber(settings, 'coverDownloadHoverBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-progress-bg-opacity', clampNumber(readNumber(settings, 'progressBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-controls-bg-opacity', clampNumber(readNumber(settings, 'controlsBgOpacity'), 0, 100) + '%');
        setRootVar('--ps-explicit-tooltip-opacity', clampNumber(readNumber(settings, 'explicitTooltipOpacity'), 0, 100) + '%');
        setRootVar('--ps-tovibe-bg-opacity', clampNumber(readNumber(settings, 'tovibeBgOpacity'), 0, 100) + '%');

        const animDuration = clampNumber(Math.round(readNumber(settings, 'fullscreenAnimationDuration')), 50, 2000);
        setRootVar('--ps-fullscreen-anim-duration', animDuration + 'ms');

        // Баннер «Моя волна обновилась» не зависит от раскладки.
        applyBannerSetting(!!readSetting(settings, 'hideVibeBanner'));
    }

    // ─────────────────────────────────────────────────────────────
    // Полноэкранный плеер: анимация открытия/закрытия и смена обложки
    // ─────────────────────────────────────────────────────────────

    let lastChangeMethod = null;

    function initFullscreenAnimations() {
        function onOpen(node) {
            const player = document.body.querySelector('[data-test-id="PLAYERBAR_DESKTOP"], [data-test-id="MOBILE_FULLSCREEN_PLAYER_MODAL"]');
            if (!player) return;

            let imageObserver = null;
            let coverObserver = null;

            if (readSetting(currentSettings, 'fullscreenAnimations')) {
                player.classList.add('PlayerBar_fullScreenAnimation_in');
                player.classList.remove('PlayerBar_fullScreenAnimation_out');

                const fsStyleObserver = new MutationObserver((mutationsList) => {
                    if (!readSetting(currentSettings, 'fullscreenAnimations')) return;
                    for (const mutation of mutationsList) {
                        if (mutation.attributeName !== 'style') continue;
                        const oldValue = mutation.oldValue;
                        const newValue = mutation.target.getAttribute('style');
                        if ((!oldValue && newValue) || (oldValue && newValue && oldValue === newValue)) continue;
                        const regex = /transform: translate\(\S*,\s*(-?\d+(?:.\d+)?)%\)/;
                        const oldTransform = regex.exec(oldValue);
                        const newTransform = regex.exec(newValue);
                        if (oldTransform && newTransform && parseFloat(oldTransform[1]) < parseFloat(newTransform[1])) {
                            onClose(player);
                            break;
                        }
                    }
                });
                fsStyleObserver.observe(node, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
            }

            const removerObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((removedNode) => {
                        if (removedNode === node || (removedNode.contains && removedNode.contains(node))) {
                            afterClose(player);
                            removerObserver.disconnect();
                            if (imageObserver) imageObserver.disconnect();
                            if (coverObserver) coverObserver.disconnect();
                        }
                    });
                });
            });
            removerObserver.observe(document.body, { childList: true, subtree: true });

            // === анимация смены обложки ===
            if (readSetting(currentSettings, 'coverAnimations')) {
                const poster = node.querySelector('[class*="FullscreenPlayerDesktopPoster_root"]');
                const hasNativeCoverCarousel = () => !!(poster && poster.querySelector('[class*="FullscreenPlayerDesktopPoster_cover_queue"]'));

                // В новых версиях приложение само рисует карусель обложек
                // previous/active/next. Клон из темы в этом случае дублирует
                // предыдущую обложку и остаётся слева после переключения.
                if (!hasNativeCoverCarousel()) {
                    const image = node.querySelector('*:not(:has(.FullscreenCoverCopy)) > [data-test-id="ENTITY_COVER_IMAGE"]');
                    if (image) {
                        const newImage = image.cloneNode(true);
                        newImage.classList.add('FullscreenCoverCopy');
                        newImage.removeAttribute('srcset');
                        newImage.removeAttribute('data-test-id');
                        image.parentNode.insertBefore(newImage, image);
                        newImage.addEventListener('animationend', (event) => {
                            if (!event.animationName.startsWith('FullscreenCoverCopy_')) return;
                            newImage.style.visibility = 'hidden';
                        });

                        imageObserver = new MutationObserver((mutationList) => {
                            if (!readSetting(currentSettings, 'coverAnimations')) return;
                            if (hasNativeCoverCarousel()) {
                                newImage.remove();
                                imageObserver.disconnect();
                                if (coverObserver) {
                                    coverObserver.disconnect();
                                    coverObserver = null;
                                }
                                return;
                            }
                            for (const mutation of mutationList) {
                                const oldValue = mutation.oldValue;
                                const realValue = mutation.target.src;
                                if (oldValue == realValue) continue;
                                newImage.src = oldValue;

                                const imgs = [newImage, image];
                                imgs.forEach((img) => {
                                    img.classList.remove('FullscreenCoverCopy_animationLeft');
                                    img.classList.remove('FullscreenCoverCopy_animationRight');
                                });

                                requestAnimationFrame(() => {
                                    const classSuffix = lastChangeMethod && lastChangeMethod.toLowerCase().includes('movebackward') ? 'Right' : 'Left';
                                    lastChangeMethod = null;
                                    newImage.style.visibility = '';
                                    imgs.forEach((img) => {
                                        img.classList.add('FullscreenCoverCopy_animation' + classSuffix);
                                    });
                                });
                            }
                        });
                        imageObserver.observe(image, { attributes: true, attributeFilter: ['src'], attributeOldValue: true });

                        // Если приложение отрисует свою карусель чуть позже,
                        // убираем клон, чтобы он не остался второй обложкой.
                        if (poster) {
                            coverObserver = new MutationObserver(() => {
                                if (!hasNativeCoverCarousel()) return;
                                newImage.remove();
                                if (imageObserver) imageObserver.disconnect();
                                if (coverObserver) {
                                    coverObserver.disconnect();
                                    coverObserver = null;
                                }
                            });
                            coverObserver.observe(poster, { childList: true, subtree: true });
                        }
                    }
                }
            }
            /* === */
        }

        function onClose(player) {
            player.classList.remove('PlayerBar_fullScreenAnimation_in');
            player.classList.add('PlayerBar_fullScreenAnimation_out');
        }

        function afterClose(player) {
            player.classList.remove('PlayerBar_fullScreenAnimation_in');
            player.classList.remove('PlayerBar_fullScreenAnimation_out');
        }

        const observer = new MutationObserver((mutationList) => {
            if (!readSetting(currentSettings, 'fullscreenAnimations') && !readSetting(currentSettings, 'coverAnimations')) return;
            for (const mutation of mutationList) {
                mutation.addedNodes.forEach((node) => {
                    if (!node || typeof node.querySelector !== 'function') return;
                    const modal = node.matches && node.matches('[data-test-id="FULLSCREEN_PLAYER_MODAL"]')
                        ? node
                        : node.querySelector('[data-test-id="FULLSCREEN_PLAYER_MODAL"]');
                    if (modal instanceof HTMLElement) onOpen(modal);
                });
            }
        });
        observer.observe(document.body, { childList: true });

        if (window.pulsesyncApi && typeof window.pulsesyncApi._waitForPlayer === 'function') {
            window.pulsesyncApi._waitForPlayer(() => {
                const entity = window.sonataState && window.sonataState.queueState && window.sonataState.queueState.currentEntity;
                if (entity && typeof entity.onChange === 'function') {
                    entity.onChange((value) => {
                        lastChangeMethod = value && value.lastChangeMethod;
                    });
                }
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Minimalistic Wave Tab
    // ─────────────────────────────────────────────────────────────

    const BANNER_STYLE_ID = 'mwt-banner-style';

    // ─── Скрытие баннера «Моя волна обновилась» ──────────────────────────
    function applyBannerSetting(hide) {
        let el = document.getElementById(BANNER_STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = BANNER_STYLE_ID;
            document.head.appendChild(el);
        }
        if (hide) {
            el.textContent = '.MainPage_actionsBar__agoxp { display: none !important; }';
        } else {
            el.textContent = '';
        }
    }

    // ─── Принудительная высота контейнера волны ──────────────────────────
    function applyWidgetHeight() {
        const STYLE_ID = 'ps-widget-height-override';
        let styleEl = document.getElementById(STYLE_ID);

        const cssText = `
            [class*="VibePage_vibeWidgetContainer"],
            [class*="MainPage_vibeWidgetContainer"] {
                height: 100vh !important;
                min-height: 100vh !important;
            }
        `;

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            document.head.appendChild(styleEl);
            styleEl.textContent = cssText;
        } else if (styleEl.textContent !== cssText) {
            styleEl.textContent = cssText;
        }

        const containers = document.querySelectorAll('[class*="VibePage_vibeWidgetContainer"], [class*="MainPage_vibeWidgetContainer"]');
        containers.forEach((el) => {
            if (el.style.getPropertyValue('height') !== '100vh') {
                el.style.setProperty('height', '100vh', 'important');
            }
            if (el.style.getPropertyValue('min-height') !== '100vh') {
                el.style.setProperty('min-height', '100vh', 'important');
            }
        });
    }

    let isFrozen = false;
    let layoutFrame = 0;
    let waveStarted = false;

    const SWIPER_HIDDEN_CLASS = 'ps-swiper-hidden-left';
    const STORAGE_KEY = 'ps_wheel_open';

    const BASE_WHEEL_WIDTH = 600;
    const OVERLAY_THRESHOLD = 750;
    const SIDE_GAP = 24;
    const MIN_CONTENT_WIDTH = 560;
    const OVERLAY_SHIFT_MIN = 78;
    const OVERLAY_SHIFT_MAX = 142;

    function isWaveEnabled() {
        return !!readSetting(currentSettings, 'waveLayoutEnabled');
    }

    function isWaveActive() {
        return !isFrozen && isWaveEnabled();
    }

    function getOverlayContentShift(rootWidth, wheelWidth) {
        const byWheel = Math.round(wheelWidth * 0.36);
        const byWindow = Math.round(rootWidth * 0.15);
        return clampNumber(Math.min(byWheel, byWindow), OVERLAY_SHIFT_MIN, OVERLAY_SHIFT_MAX);
    }

    function getRoot() {
        return document.querySelector('[class*="VibePage_root"]');
    }

    function getMeta() {
        return document.querySelector('[class*="VibePage_meta"]');
    }

    function getWheelElement() {
        const root = getRoot();
        if (root) {
            const wheelInRoot = root.querySelector('.swiper[class*="VibePage_wheel"], .swiper.VibePage_wheel__E_p8_');
            if (wheelInRoot) return wheelInRoot;
            const anySwiperInRoot = root.querySelector('.swiper');
            if (anySwiperInRoot) return anySwiperInRoot;
        }
        return document.querySelector('.swiper[class*="VibePage_wheel"], .swiper.VibePage_wheel__E_p8_, .swiper');
    }

    function getAnimationElement() {
        let el = document.querySelector('canvas');
        if (el) return el;
        el = document.querySelector('[class*="VibeWidgetAnimation_root"]');
        return el;
    }

    function isLiteAnimationElement(el) {
        return !!(el && el.tagName !== 'CANVAS' && typeof el.matches === 'function' && el.matches('[class*="VibeWidgetAnimation_root"]'));
    }

    function isOverlayMode(rootWidth) {
        const width = typeof rootWidth === 'number' && rootWidth > 0 ? rootWidth : window.innerWidth;
        return width < OVERLAY_THRESHOLD;
    }

    function isWheelOpen(swiper) {
        return !!swiper && !swiper.classList.contains(SWIPER_HIDDEN_CLASS);
    }

    function scheduleLayout() {
        if (!isWaveActive()) return;
        if (layoutFrame) cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(() => {
            layoutFrame = 0;
            updateLayout();
        });
    }

    function scheduleLayoutBurst() {
        if (!isWaveActive()) return;
        scheduleLayout();
        [40, 90, 160, 240, 340, 460].forEach((delay) => {
            setTimeout(() => {
                if (isWaveActive()) scheduleLayout();
            }, delay);
        });
    }

    function saveWheelState(isOpen) {
        localStorage.setItem(STORAGE_KEY, isOpen ? 'true' : 'false');
    }

    function loadWheelState() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function applyWheelState(swiper, content, animEl, isOpen) {
        if (!swiper || !isWaveActive()) return;
        swiper.classList.toggle(SWIPER_HIDDEN_CLASS, !isOpen);
        if (content) content.classList.toggle('ps-content-shifted', isOpen);
        if (animEl) animEl.classList.toggle('ps-canvas-shifted', isOpen);
        scheduleLayoutBurst();
    }

    function resetLayoutStyles(swiper, meta) {
        if (meta) {
            meta.classList.remove('ps-content-shifted');
            meta.style.marginLeft = '';
            meta.style.width = '';
            meta.style.maxWidth = '';
            meta.style.paddingLeft = '';
            meta.style.paddingRight = '';
            meta.style.transform = '';
            meta.style.transformOrigin = '';
            meta.removeAttribute('data-ps-layout-mode');
        }
        if (swiper) {
            swiper.style.width = '';
            swiper.style.maxWidth = '';
            swiper.style.position = '';
            swiper.style.zIndex = '';
            swiper.style.transform = '';
        }
        const root = getRoot();
        if (root) {
            root.style.removeProperty('--ps-wheel-width');
            root.style.removeProperty('--ps-wheel-max-width');
            root.style.removeProperty('--ps-overlay-content-shift');
        }
    }

    function resetWaveLayout() {
        const swiper = getWheelElement();
        const meta = getMeta();
        resetLayoutStyles(swiper, meta);

        document.documentElement.style.removeProperty('--ps-player-width');

        const cover = document.querySelector('[class*="AlbumCover_root"]');
        if (cover) cover.style.transform = '';

        const animEl = getAnimationElement();
        if (animEl) {
            animEl.classList.remove('ps-lite-animation', 'ps-canvas-shifted');
            ['display', 'position', 'width', 'height', 'z-index', 'pointer-events', 'left', 'top', 'transform', 'visibility', 'opacity', 'object-fit']
                .forEach((prop) => animEl.style.removeProperty(prop));
        }

        const btn = document.getElementById('ps-custom-settings-btn');
        if (btn) btn.remove();

        const heightStyle = document.getElementById('ps-widget-height-override');
        if (heightStyle) heightStyle.remove();

        document.querySelectorAll('[class*="VibePage_vibeWidgetContainer"], [class*="MainPage_vibeWidgetContainer"]').forEach((el) => {
            el.style.removeProperty('height');
            el.style.removeProperty('min-height');
        });
    }

    function applyAll(settings) {
        if (isFrozen) return;

        applyBannerSetting(!!readSetting(settings, 'hideVibeBanner'));

        if (!isWaveEnabled()) return;

        const playerWidth = readNumber(settings, 'playerWidth');
        const coverOffsetX = readNumber(settings, 'coverOffsetX');

        document.documentElement.style.setProperty('--ps-player-width', playerWidth + '%');

        const cover = document.querySelector('[class*="AlbumCover_root"]');
        if (cover) {
            cover.style.transform = `translateX(${coverOffsetX}px)`;
        }

        const animEl = getAnimationElement();
        if (animEl) {
            animEl.style.display = readSetting(settings, 'animationEnabled') ? '' : 'none';
        }

        applyWidgetHeight();
        scheduleLayout();
    }

    // ============================================================
    // ЦЕНТРИРОВАНИЕ АНИМАЦИИ
    // ============================================================

    function centerCanvas() {
        if (!isWaveActive()) return;

        const animEl = getAnimationElement();
        if (!animEl) return;

        const enabled = readSetting(currentSettings, 'animationEnabled');
        if (!enabled) {
            animEl.style.display = 'none';
            return;
        }
        animEl.style.display = '';

        const root = getRoot();
        if (!root) return;

        const rootRect = root.getBoundingClientRect();
        if (rootRect.width === 0 || rootRect.height === 0) return;

        const meta = getMeta();
        const swiper = getWheelElement();
        const wheelOpen = isWheelOpen(swiper);
        const layoutMode = meta ? meta.getAttribute('data-ps-layout-mode') : '';
        const isLiteModeAnimation = isLiteAnimationElement(animEl);

        const useMetaRect = !!(meta && wheelOpen && (layoutMode === 'side' || layoutMode === 'overlay-shift'));
        const frameRect = useMetaRect ? meta.getBoundingClientRect() : rootRect;

        if (frameRect.width === 0 || frameRect.height === 0) return;

        const topOffset = readNumber(currentSettings, 'animationTopOffset');
        const leftOffset = readNumber(currentSettings, 'animationLeftOffset');
        const scale = readNumber(currentSettings, 'animationScale');

        // Реальные размеры окна для стабильности
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const actualWidth = Math.max(rootRect.width, windowWidth);
        const actualHeight = Math.max(rootRect.height, windowHeight);

        let size;
        if (isLiteModeAnimation) {
            const liteBaseScale = 0.78;
            const base = Math.min(actualWidth, actualHeight);
            const minSize = Math.min(260, base);
            const maxSize = Math.max(minSize, Math.min(1400, actualHeight * 1.55, actualWidth * 0.92));
            size = clampNumber(base * liteBaseScale * scale, minSize, maxSize);
        } else {
            // Волна должна быть квадратной и покрывать весь экран
            size = Math.max(actualWidth, actualHeight) * scale;
        }

        const localLeft = useMetaRect ? (frameRect.left - rootRect.left) : 0;
        const centerX = localLeft + (frameRect.width - size) / 2 + leftOffset;
        const centerY = (actualHeight - size) / 2 + topOffset;

        animEl.classList.toggle('ps-lite-animation', isLiteModeAnimation);
        animEl.style.position = 'absolute';
        animEl.style.setProperty('width', size + 'px', 'important');
        animEl.style.setProperty('height', size + 'px', 'important');
        animEl.style.zIndex = '0';
        animEl.style.pointerEvents = 'none';

        if (isLiteModeAnimation) {
            animEl.style.setProperty('left', centerX + 'px', 'important');
            animEl.style.setProperty('top', centerY + 'px', 'important');
            animEl.style.setProperty('transform', 'none', 'important');
            const img = animEl.querySelector('img');
            if (img) img.style.objectFit = 'contain';
        } else {
            animEl.style.setProperty('left', '0px', 'important');
            animEl.style.setProperty('top', '0px', 'important');
            animEl.style.setProperty('transform', `translate(${centerX}px, ${centerY}px)`, 'important');
            if (animEl.tagName === 'CANVAS') animEl.style.objectFit = '';
        }

        animEl.style.visibility = 'visible';
        animEl.style.opacity = '1';
    }

    function moveAnimationToRoot() {
        if (!isWaveActive()) return false;
        const animEl = getAnimationElement();
        if (!animEl) return false;
        const root = getRoot();
        if (root && animEl.parentElement !== root) {
            root.insertBefore(animEl, root.firstChild);
            return true;
        }
        return false;
    }

    function updateLayout() {
        if (!isWaveActive()) return;

        const swiper = getWheelElement();
        const meta = getMeta();
        const root = getRoot();

        if (!root) return;

        moveAnimationToRoot();

        if (!swiper || !meta) {
            centerCanvas();
            applyWidgetHeight();
            return;
        }

        const rootRect = root.getBoundingClientRect();
        const rootWidth = rootRect.width || window.innerWidth;
        const open = isWheelOpen(swiper);

        if (!open) {
            resetLayoutStyles(swiper, meta);
            centerCanvas();
            applyWidgetHeight();
            return;
        }

        meta.classList.add('ps-content-shifted');

        let wheelWidth = BASE_WHEEL_WIDTH;
        if (rootWidth < 1100) wheelWidth = 420;
        if (rootWidth < 960) wheelWidth = 340;

        wheelWidth = Math.min(wheelWidth, Math.floor(rootWidth * 0.42));
        wheelWidth = Math.max(280, wheelWidth);

        const needOverlay = isOverlayMode(rootWidth) || (rootWidth - wheelWidth - SIDE_GAP < MIN_CONTENT_WIDTH);

        swiper.style.position = 'absolute';
        swiper.style.transform = '';
        root.style.setProperty('--ps-wheel-width', wheelWidth + 'px');

        if (needOverlay) {
            const overlayWidth = Math.min(320, Math.floor(rootWidth * 0.8));
            const contentShift = getOverlayContentShift(rootWidth, overlayWidth);

            root.style.setProperty('--ps-wheel-width', overlayWidth + 'px');
            root.style.setProperty('--ps-wheel-max-width', '80vw');
            root.style.setProperty('--ps-overlay-content-shift', contentShift + 'px');

            swiper.style.width = overlayWidth + 'px';
            swiper.style.maxWidth = '80vw';
            swiper.style.zIndex = '200';

            meta.setAttribute('data-ps-layout-mode', 'overlay-shift');
            meta.style.marginLeft = '0px';
            meta.style.width = '100%';
            meta.style.maxWidth = '100%';
            meta.style.paddingLeft = '16px';
            meta.style.paddingRight = '16px';
            meta.style.transform = `translateX(${contentShift}px)`;
            meta.style.transformOrigin = 'center center';
        } else {
            const occupied = wheelWidth + SIDE_GAP;

            root.style.setProperty('--ps-wheel-width', wheelWidth + 'px');
            root.style.setProperty('--ps-wheel-max-width', '90vw');

            swiper.style.width = wheelWidth + 'px';
            swiper.style.maxWidth = '90vw';
            swiper.style.zIndex = '100';

            meta.setAttribute('data-ps-layout-mode', 'side');
            meta.style.marginLeft = occupied + 'px';
            meta.style.width = `calc(100% - ${occupied}px)`;
            meta.style.maxWidth = `calc(100% - ${occupied}px)`;
            meta.style.paddingLeft = '16px';
            meta.style.paddingRight = '16px';
            meta.style.transform = '';
            meta.style.transformOrigin = '';
        }

        centerCanvas();
        applyWidgetHeight();
    }

    const globalObserver = new MutationObserver(() => {
        if (!isWaveActive()) return;
        const root = getRoot();
        if (!root) return;
        moveAnimationToRoot();
        const swiper = getWheelElement();
        if (swiper) {
            if (!document.getElementById('ps-custom-settings-btn')) {
                initSwiperToggle();
            }
        }
        scheduleLayout();
    });

    const coverObserver = new MutationObserver(() => {
        if (!isWaveActive()) return;
        const cover = document.querySelector('[class*="AlbumCover_root"]');
        if (cover && currentSettings && Object.keys(currentSettings).length > 0) {
            applyAll(currentSettings);
            coverObserver.disconnect();
        }
    });

    function initSwiperToggle() {
        if (!isWaveActive()) return;
        const swiper = getWheelElement();
        if (!swiper) return;

        const meta = getMeta();
        const animEl = getAnimationElement();
        const savedOpen = loadWheelState();
        applyWheelState(swiper, meta, animEl, savedOpen);

        if (document.getElementById('ps-custom-settings-btn')) {
            scheduleLayout();
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'ps-custom-settings-btn';
        btn.type = 'button';
        btn.className = 'cpeagBA1_PblpJn8Xgtv iJVAJMgccD4vj4E4o068 zIMibMuH7wcqUoW7KH1B IlG7b1K0AD7E7AMx6F5p nHWc2sto1C6Gm0Dpw_l0 C_QGmfTz6UFX93vfPt6Z qU2apWBO1yyEK0lZ3lPO kc5CjvU5hT9KEj0iTt3C VibeSettings_toggleSettingsButton__j6fIU';
        btn.setAttribute('aria-label', 'Настроить Мою волну');
        btn.innerHTML = `
            <span class="JjlbHZ4FaP9EAcR_1DxF">
                <svg class="J9wTKytjOWG73QMoN5WP elJfazUBui03YWZgHCbW l3tE1hAMmBj2aoPPwU08" focusable="false" aria-hidden="true">
                    <use xlink:href="/icons/sprite.svg#filter_xxs"></use>
                </svg>
                <span class="_MWOVuZRvUQdXKTMcOPx tk7ahHRDYXJMMB879KUA _3_Mxw7Si7j2g4kWjlpR">Настроить</span>
            </span>
        `;

        btn.addEventListener('click', () => {
            if (!isWaveActive()) return;
            const currentSwiper = getWheelElement();
            if (!currentSwiper) return;
            currentSwiper.classList.toggle(SWIPER_HIDDEN_CLASS);
            const content = getMeta();
            const animElNow = getAnimationElement();
            const open = isWheelOpen(currentSwiper);
            if (content) content.classList.toggle('ps-content-shifted', open);
            if (animElNow) animElNow.classList.toggle('ps-canvas-shifted', open);
            saveWheelState(open);
            scheduleLayoutBurst();
        });

        const resetButtonRoot = document.querySelector('[class*="VibeResetButton_root"]');
        if (resetButtonRoot && resetButtonRoot.parentNode) {
            resetButtonRoot.parentNode.insertBefore(btn, resetButtonRoot.nextSibling);
        } else {
            const metaContainer = getMeta();
            if (metaContainer) {
                const playerBlock = metaContainer.querySelector('[class*="VibePage_playerBlock"]');
                if (playerBlock) metaContainer.insertBefore(btn, playerBlock);
                else metaContainer.appendChild(btn);
            }
        }
        scheduleLayout();
    }

    let swiperObserver = null;
    function startSwiperObserver() {
        if (swiperObserver) swiperObserver.disconnect();
        swiperObserver = new MutationObserver(() => {
            if (!isWaveActive()) return;
            const swiper = getWheelElement();
            if (!swiper) return;
            const meta = getMeta();
            const animEl = getAnimationElement();
            const savedOpen = loadWheelState();
            applyWheelState(swiper, meta, animEl, savedOpen);
            if (!document.getElementById('ps-custom-settings-btn')) {
                initSwiperToggle();
            } else {
                scheduleLayout();
            }
        });
        swiperObserver.observe(document.body, { childList: true, subtree: true });
    }

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (!isWaveActive()) return;
        const url = location.href;
        if (url === lastUrl) return;
        lastUrl = url;
        setTimeout(() => {
            if (!isWaveActive()) return;
            const root = getRoot();
            if (root) {
                moveAnimationToRoot();
                if (currentSettings && Object.keys(currentSettings).length > 0) {
                    applyAll(currentSettings);
                }
            }
            const swiper = getWheelElement();
            if (swiper && !document.getElementById('ps-custom-settings-btn')) {
                initSwiperToggle();
            } else if (swiper) {
                const meta = getMeta();
                const animEl = getAnimationElement();
                applyWheelState(swiper, meta, animEl, loadWheelState());
            }
            scheduleLayout();
        }, 300);
    });

    function startAddon() {
        if (waveStarted) return;
        waveStarted = true;

        globalObserver.observe(document.body, { childList: true, subtree: true });
        coverObserver.observe(document.body, { childList: true, subtree: true });

        if (!isFrozen) {
            moveAnimationToRoot();
            applyAll(currentSettings);
            initSwiperToggle();
            applyWidgetHeight();
            scheduleLayout();
        }

        window.addEventListener('resize', () => {
            if (isWaveActive()) scheduleLayoutBurst();
        });

        document.addEventListener('transitionend', (event) => {
            if (!isWaveActive()) return;
            const target = event.target;
            if (!target || typeof target.matches !== 'function') return;
            if (target.matches('[class*="VibePage_meta"]') || target.matches('.swiper[class*="VibePage_wheel"], .swiper.VibePage_wheel__E_p8_')) {
                scheduleLayout();
            }
        }, true);

        setTimeout(() => { if (isWaveActive()) scheduleLayout(); }, 500);
        setTimeout(() => { if (isWaveActive()) scheduleLayout(); }, 1500);
        setTimeout(() => { if (isWaveActive()) scheduleLayout(); }, 2500);

        startSwiperObserver();
        urlObserver.observe(document, { subtree: true, childList: true });
    }

    function freeze() {
        if (isFrozen) return;
        isFrozen = true;
        if (layoutFrame) {
            cancelAnimationFrame(layoutFrame);
            layoutFrame = 0;
        }
    }

    function unfreeze() {
        if (!isFrozen) return;
        isFrozen = false;
        if (settingsApi) {
            currentSettings = settingsApi.getCurrent() || {};
            applyThemeSettings(currentSettings);
        }
        if (isWaveEnabled()) {
            applyAll(currentSettings);
            const swiper = getWheelElement();
            if (swiper && !document.getElementById('ps-custom-settings-btn')) {
                initSwiperToggle();
            }
            scheduleLayout();
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) freeze();
        else unfreeze();
    });

    // ─────────────────────────────────────────────────────────────
    // Инициализация настроек
    // ─────────────────────────────────────────────────────────────

    let initStartedAt = Date.now();

    function onSettingsChanged(newSettings) {
        const wasWaveEnabled = isWaveEnabled();
        currentSettings = (newSettings && typeof newSettings === 'object') ? newSettings : {};
        applyThemeSettings(currentSettings);

        if (!isWaveEnabled()) {
            resetWaveLayout();
            return;
        }

        if (!waveStarted) {
            startAddon();
            return;
        }

        applyAll(currentSettings);

        if (!document.getElementById('ps-custom-settings-btn')) {
            initSwiperToggle();
        } else if (!wasWaveEnabled) {
            const swiper = getWheelElement();
            if (swiper) applyWheelState(swiper, getMeta(), getAnimationElement(), loadWheelState());
        }

        scheduleLayoutBurst();
    }

    function initSettings() {
        if (!window.pulsesyncApi) {
            if (Date.now() - initStartedAt > 10000) {
                startAddon();
                return;
            }
            setTimeout(initSettings, 500);
            return;
        }

        let api = null;
        try {
            api = window.pulsesyncApi.getSettings(ADDON_NAME);
        } catch (error) {
            api = null;
        }

        if (!api || typeof api.onChange !== 'function') {
            if (Date.now() - initStartedAt > 10000) {
                startAddon();
                return;
            }
            setTimeout(initSettings, 1000);
            return;
        }

        settingsApi = api;
        currentSettings = api.getCurrent() || {};
        applyThemeSettings(currentSettings);

        if (isWaveEnabled()) startAddon();

        api.onChange(onSettingsChanged);
    }

    function waitForPlayer(callback) {
        if (!window.pulsesyncApi) {
            setTimeout(() => waitForPlayer(callback), 200);
            return;
        }
        if (typeof window.pulsesyncApi._waitForPlayer === 'function') {
            window.pulsesyncApi._waitForPlayer(() => {
                setTimeout(callback, 1500);
            });
            return;
        }
        if (window.Theme) {
            try {
                const theme = new window.Theme(ADDON_NAME);
                theme.player.on('ready', () => {
                    setTimeout(callback, 1500);
                });
                return;
            } catch (e) {}
        }
        setTimeout(callback, 3000);
    }

    function boot() {
        addLiquidGlass();

        // Тема применяется сразу, чтобы не было вспышки стандартных стилей.
        applyThemeSettings(currentSettings);
        initFullscreenAnimations();
        waitForPlayer(initSettings);
    }

    if (document.body) {
        boot();
    } else {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    }
})();
