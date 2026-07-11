/**
 * VCPdesktop - 拖拽 / 缩放系统模块
 * 负责：挂件拖拽交互、八向鼠标缩放、边界限位、光标状态管理
 */

'use strict';

(function () {
    const { CONSTANTS, zIndex } = window.VCPDesktop;

    const RESIZE_HANDLES = [
        { dir: 'n', cursor: 'ns-resize' },
        { dir: 's', cursor: 'ns-resize' },
        { dir: 'e', cursor: 'ew-resize' },
        { dir: 'w', cursor: 'ew-resize' },
        { dir: 'ne', cursor: 'nesw-resize' },
        { dir: 'nw', cursor: 'nwse-resize' },
        { dir: 'se', cursor: 'nwse-resize' },
        { dir: 'sw', cursor: 'nesw-resize' },
    ];

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

    /**
     * 为挂件设置拖拽行为
     * @param {HTMLElement} widgetElement - 挂件容器元素
     * @param {HTMLElement} gripElement - 拖拽手柄元素
     */
    function setupDrag(widgetElement, gripElement) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;

        gripElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // 锁定状态下禁止拖拽
            if (isDesktopLocked()) return;
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            originLeft = parseInt(widgetElement.style.left) || 0;
            originTop = parseInt(widgetElement.style.top) || 0;

            gripElement.style.cursor = 'grabbing';

            // 拖拽期间提升z-index
            const widgetId = widgetElement.dataset.widgetId;
            zIndex.bringToFront(widgetId);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = originLeft + dx;
            let newTop = originTop + dy;

            // === 拖拽限位 ===
            const widgetW = widgetElement.offsetWidth;
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;
            const minVisible = CONSTANTS.DRAG_MIN_VISIBLE;

            // 上边界：不能拖入标题栏区域
            if (newTop < CONSTANTS.TITLE_BAR_HEIGHT) {
                newTop = CONSTANTS.TITLE_BAR_HEIGHT;
            }

            // 下边界：至少保留minVisible在屏幕内
            if (newTop > viewH - minVisible) {
                newTop = viewH - minVisible;
            }

            // 左边界
            if (newLeft < -(widgetW - minVisible)) {
                newLeft = -(widgetW - minVisible);
            }

            // 右边界
            if (newLeft > viewW - minVisible) {
                newLeft = viewW - minVisible;
            }

            widgetElement.style.left = `${newLeft}px`;
            widgetElement.style.top = `${newTop}px`;
        }

        function onMouseUp() {
            if (!isDragging) return;
            isDragging = false;
            gripElement.style.cursor = '';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    /**
     * 为挂件设置八向鼠标缩放
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
            handle.addEventListener('mousedown', (e) => startResize(e, dir));
            handlesRoot.appendChild(handle);
        });

        widgetElement.appendChild(handlesRoot);

        function startResize(e, dir) {
            if (e.button !== 0) return;
            if (isDesktopLocked()) return;
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const originLeft = parseInt(widgetElement.style.left, 10) || widgetElement.offsetLeft || 0;
            const originTop = parseInt(widgetElement.style.top, 10) || widgetElement.offsetTop || 0;
            const originWidth = widgetElement.offsetWidth;
            const originHeight = widgetElement.offsetHeight;
            const minW = CONSTANTS.MIN_WIDGET_WIDTH || 120;
            const minH = CONSTANTS.MIN_WIDGET_HEIGHT || 60;

            widgetElement.classList.add('resizing');
            zIndex.bringToFront(widgetElement.dataset.widgetId);
            markUserResized(widgetElement);

            const onMouseMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                let left = originLeft;
                let top = originTop;
                let width = originWidth;
                let height = originHeight;

                if (dir.includes('e')) {
                    width = originWidth + dx;
                }
                if (dir.includes('s')) {
                    height = originHeight + dy;
                }
                if (dir.includes('w')) {
                    width = originWidth - dx;
                    left = originLeft + dx;
                }
                if (dir.includes('n')) {
                    height = originHeight - dy;
                    top = originTop + dy;
                }

                if (width < minW) {
                    if (dir.includes('w')) {
                        left = originLeft + (originWidth - minW);
                    }
                    width = minW;
                }
                if (height < minH) {
                    if (dir.includes('n')) {
                        top = originTop + (originHeight - minH);
                    }
                    height = minH;
                }

                // 上边界不低于标题栏
                if (top < CONSTANTS.TITLE_BAR_HEIGHT) {
                    if (dir.includes('n')) {
                        height -= (CONSTANTS.TITLE_BAR_HEIGHT - top);
                        if (height < minH) height = minH;
                    }
                    top = CONSTANTS.TITLE_BAR_HEIGHT;
                }

                widgetElement.style.left = `${left}px`;
                widgetElement.style.top = `${top}px`;
                widgetElement.style.width = `${width}px`;
                widgetElement.style.height = `${height}px`;
                widgetElement.style.transition = 'none';
            };

            const onMouseUp = () => {
                widgetElement.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
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