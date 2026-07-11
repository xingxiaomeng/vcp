/**
 * VCPdesktop - 拖拽 / 缩放系统模块
 * 负责：挂件拖拽交互、八向鼠标缩放、边界限位、光标状态管理
 *
 * 体验要点：
 * - 顶部宽抓手区（易抓取），与顶边缩放分离（顶中=拖动，四角/侧边=缩放）
 * - Pointer Capture 防丢鼠；阈值防误拖；rAF 跟手；拖动中禁用选中
 */

'use strict';

(function () {
    const { CONSTANTS, zIndex } = window.VCPDesktop;

    // 顶边中段留给拖动，不放全宽 N 手柄，避免与抓手抢事件
    const RESIZE_HANDLES = [
        { dir: 's', cursor: 'ns-resize' },
        { dir: 'e', cursor: 'ew-resize' },
        { dir: 'w', cursor: 'ew-resize' },
        { dir: 'ne', cursor: 'nesw-resize' },
        { dir: 'nw', cursor: 'nwse-resize' },
        { dir: 'se', cursor: 'nwse-resize' },
        { dir: 'sw', cursor: 'nesw-resize' },
    ];

    const DRAG_THRESHOLD_PX = 3;
    let activeInteraction = null; // 'drag' | 'resize' | null

    function isDesktopLocked() {
        return !!(window.VCPDesktop.state && window.VCPDesktop.state.desktopLocked);
    }

    function getWidgetData(widgetElement) {
        const widgetId = widgetElement && widgetElement.dataset
            ? widgetElement.dataset.widgetId
            : null;
        if (!widgetId || !window.VCPDesktop.state || !window.VCPDesktop.state.widgets) {
            return null;
        }
        return window.VCPDesktop.state.widgets.get(widgetId) || null;
    }

    function markUserResized(widgetElement) {
        const widgetData = getWidgetData(widgetElement);
        if (!widgetData) return;
        widgetData.userResized = true;
        widgetData.fixedSize = true;
        widgetElement.classList.add('user-resized');
    }

    function readBox(widgetElement) {
        return {
            left: parseFloat(widgetElement.style.left) || widgetElement.offsetLeft || 0,
            top: parseFloat(widgetElement.style.top) || widgetElement.offsetTop || 0,
            width: widgetElement.offsetWidth,
            height: widgetElement.offsetHeight,
        };
    }

    function clampDragPosition(left, top, widgetW, widgetH) {
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const minVisible = CONSTANTS.DRAG_MIN_VISIBLE;
        let newLeft = left;
        let newTop = top;

        if (newTop < CONSTANTS.TITLE_BAR_HEIGHT) {
            newTop = CONSTANTS.TITLE_BAR_HEIGHT;
        }
        if (newTop > viewH - minVisible) {
            newTop = viewH - minVisible;
        }
        if (newLeft < -(widgetW - minVisible)) {
            newLeft = -(widgetW - minVisible);
        }
        if (newLeft > viewW - minVisible) {
            newLeft = viewW - minVisible;
        }

        return { left: newLeft, top: newTop };
    }

    function setBodyInteractionCursor(cursor) {
        if (cursor) {
            document.body.style.cursor = cursor;
            document.body.classList.add('desktop-widget-interacting');
        } else {
            document.body.style.cursor = '';
            document.body.classList.remove('desktop-widget-interacting');
        }
    }

    /**
     * 为挂件设置拖拽行为
     * @param {HTMLElement} widgetElement - 挂件容器元素
     * @param {HTMLElement} gripElement - 拖拽手柄元素
     */
    function setupDrag(widgetElement, gripElement) {
        let pointerId = null;
        let started = false;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;
        let widgetW = 0;
        let widgetH = 0;
        let rafId = 0;
        let pendingLeft = null;
        let pendingTop = null;

        function flushPosition() {
            rafId = 0;
            if (pendingLeft == null) return;
            widgetElement.style.left = `${pendingLeft}px`;
            widgetElement.style.top = `${pendingTop}px`;
            pendingLeft = null;
            pendingTop = null;
        }

        function schedulePosition(left, top) {
            pendingLeft = left;
            pendingTop = top;
            if (!rafId) {
                rafId = requestAnimationFrame(flushPosition);
            }
        }

        function endDrag(e) {
            if (!started) return;
            started = false;

            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
                flushPosition();
            }

            if (pointerId != null && gripElement.hasPointerCapture?.(pointerId)) {
                try { gripElement.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
            }
            pointerId = null;

            gripElement.removeEventListener('pointermove', onPointerMove);
            gripElement.removeEventListener('pointerup', onPointerUp);
            gripElement.removeEventListener('pointercancel', onPointerUp);
            window.removeEventListener('blur', onPointerUp);

            widgetElement.classList.remove('dragging');
            widgetElement.style.willChange = '';
            setBodyInteractionCursor('');
            activeInteraction = null;
            dragging = false;

            if (e) {
                e.preventDefault?.();
            }
        }

        function onPointerMove(e) {
            if (!started || e.pointerId !== pointerId) return;
            if (activeInteraction && activeInteraction !== 'drag') return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!dragging) {
                if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
                    return;
                }
                dragging = true;
                activeInteraction = 'drag';
                widgetElement.classList.add('dragging');
                widgetElement.style.willChange = 'left, top';
                widgetElement.style.transition = 'none';
                setBodyInteractionCursor('grabbing');
                zIndex.bringToFront(widgetElement.dataset.widgetId);
            }

            const clamped = clampDragPosition(originLeft + dx, originTop + dy, widgetW, widgetH);
            schedulePosition(clamped.left, clamped.top);
            e.preventDefault();
        }

        function onPointerUp(e) {
            if (e && pointerId != null && e.pointerId !== pointerId && e.type !== 'blur') return;
            endDrag(e);
        }

        gripElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (isDesktopLocked()) return;
            if (activeInteraction) return;

            // 忽略来自缩放手柄的事件（若冒泡）
            if (e.target && e.target.closest && e.target.closest('.desktop-widget-resize-handle')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const box = readBox(widgetElement);
            started = true;
            dragging = false;
            pointerId = e.pointerId;
            startX = e.clientX;
            startY = e.clientY;
            originLeft = box.left;
            originTop = box.top;
            widgetW = box.width;
            widgetH = box.height;

            try {
                gripElement.setPointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }

            gripElement.addEventListener('pointermove', onPointerMove);
            gripElement.addEventListener('pointerup', onPointerUp);
            gripElement.addEventListener('pointercancel', onPointerUp);
            window.addEventListener('blur', onPointerUp);
        });
    }

    /**
     * 为挂件设置鼠标缩放（侧边 + 四角；顶中留给拖动）
     * @param {HTMLElement} widgetElement
     */
    function setupResize(widgetElement) {
        if (!widgetElement || widgetElement.dataset.resizeReady === '1') return;
        widgetElement.dataset.resizeReady = '1';

        const handlesRoot = document.createElement('div');
        handlesRoot.className = 'desktop-widget-resize-handles';
        handlesRoot.setAttribute('aria-hidden', 'true');

        RESIZE_HANDLES.forEach(({ dir, cursor }) => {
            const handle = document.createElement('div');
            handle.className = `desktop-widget-resize-handle desktop-widget-resize-${dir}`;
            handle.dataset.dir = dir;
            handle.style.cursor = cursor;
            handle.title = '拖拽缩放';
            handle.addEventListener('pointerdown', (e) => startResize(e, dir, handle));
            handlesRoot.appendChild(handle);
        });

        widgetElement.appendChild(handlesRoot);

        function startResize(e, dir, handle) {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (isDesktopLocked()) return;
            if (activeInteraction) return;

            e.preventDefault();
            e.stopPropagation();

            const pointerId = e.pointerId;
            const startX = e.clientX;
            const startY = e.clientY;
            const origin = readBox(widgetElement);
            const minW = CONSTANTS.MIN_WIDGET_WIDTH || 120;
            const minH = CONSTANTS.MIN_WIDGET_HEIGHT || 60;
            let rafId = 0;
            let pending = null;

            activeInteraction = 'resize';
            widgetElement.classList.add('resizing');
            widgetElement.style.willChange = 'left, top, width, height';
            widgetElement.style.transition = 'none';
            zIndex.bringToFront(widgetElement.dataset.widgetId);
            markUserResized(widgetElement);
            setBodyInteractionCursor(handle.style.cursor || 'nwse-resize');

            try {
                handle.setPointerCapture(pointerId);
            } catch (_) { /* ignore */ }

            function flush() {
                rafId = 0;
                if (!pending) return;
                widgetElement.style.left = `${pending.left}px`;
                widgetElement.style.top = `${pending.top}px`;
                widgetElement.style.width = `${pending.width}px`;
                widgetElement.style.height = `${pending.height}px`;
                pending = null;
            }

            function onPointerMove(ev) {
                if (ev.pointerId !== pointerId) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                let left = origin.left;
                let top = origin.top;
                let width = origin.width;
                let height = origin.height;

                if (dir.includes('e')) width = origin.width + dx;
                if (dir.includes('s')) height = origin.height + dy;
                if (dir.includes('w')) {
                    width = origin.width - dx;
                    left = origin.left + dx;
                }
                if (dir.includes('n')) {
                    height = origin.height - dy;
                    top = origin.top + dy;
                }

                if (width < minW) {
                    if (dir.includes('w')) left = origin.left + (origin.width - minW);
                    width = minW;
                }
                if (height < minH) {
                    if (dir.includes('n')) top = origin.top + (origin.height - minH);
                    height = minH;
                }

                if (top < CONSTANTS.TITLE_BAR_HEIGHT) {
                    if (dir.includes('n')) {
                        height -= (CONSTANTS.TITLE_BAR_HEIGHT - top);
                        if (height < minH) height = minH;
                    }
                    top = CONSTANTS.TITLE_BAR_HEIGHT;
                }

                pending = { left, top, width, height };
                if (!rafId) rafId = requestAnimationFrame(flush);
                ev.preventDefault();
            }

            function onPointerUp(ev) {
                if (ev && ev.type !== 'blur' && ev.pointerId !== pointerId) return;

                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = 0;
                    flush();
                }

                if (handle.hasPointerCapture?.(pointerId)) {
                    try { handle.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
                }

                handle.removeEventListener('pointermove', onPointerMove);
                handle.removeEventListener('pointerup', onPointerUp);
                handle.removeEventListener('pointercancel', onPointerUp);
                window.removeEventListener('blur', onPointerUp);

                widgetElement.classList.remove('resizing');
                widgetElement.style.willChange = '';
                setBodyInteractionCursor('');
                activeInteraction = null;
            }

            handle.addEventListener('pointermove', onPointerMove);
            handle.addEventListener('pointerup', onPointerUp);
            handle.addEventListener('pointercancel', onPointerUp);
            window.addEventListener('blur', onPointerUp);
        }
    }

    // ============================================================
    // 导出
    // ============================================================
    window.VCPDesktop = window.VCPDesktop || {};
    window.VCPDesktop.drag = {
        setup: setupDrag,
        setupResize,
    };

})();
