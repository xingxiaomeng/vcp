/**
 * VCPdesktop - 挂件标准能力层
 *
 * 所有通过 VCPDesktop.widget.create() 创建的挂件（内置 / 收藏 /
 * DESKTOP_PUSH / Remote RPC）都必须经过本模块安装标准宿主能力。
 *
 * 新增挂件功能时：优先加到这里，而不是改各个 builtinWidgets。
 */

'use strict';

(function () {
    /**
     * 宿主自动提供的标准能力清单（新建挂件无需自行实现）
     */
    const CAPABILITIES = Object.freeze([
        {
            id: 'drag',
            name: '顶部拖动',
            description: '顶部抓手区拖动位置；Pointer Capture + 阈值防误拖',
        },
        {
            id: 'resize',
            name: '八向缩放',
            description: '四角与侧边/底边鼠标缩放；顶中留给拖动',
        },
        {
            id: 'close',
            name: '关闭按钮',
            description: '悬停显示关闭；桌面锁定时隐藏',
        },
        {
            id: 'contextMenu',
            name: '右键菜单',
            description: '收藏、刷新、置顶等桌面菜单',
        },
        {
            id: 'zIndex',
            name: '层级提升',
            description: '点击/拖动时自动置顶',
        },
        {
            id: 'shadowDom',
            name: 'Shadow DOM 隔离',
            description: '样式与脚本沙箱隔离',
        },
        {
            id: 'fluidLayout',
            name: '流体布局适配',
            description: '内容区随挂件外框拉伸；手动缩放后锁定尺寸',
        },
        {
            id: 'desktopLock',
            name: '桌面锁定兼容',
            description: '锁定后禁用拖动/缩放/关闭',
        },
    ]);

    const CHROME_FLAG = 'vcpStandardChrome';
    const FLUID_STYLE_ATTR = 'data-vcp-fluid-host';

    function getDragApi() {
        return window.VCPDesktop && window.VCPDesktop.drag;
    }

    /**
     * 宿主 Shadow 内基础样式：让任意新挂件内容可随外框缩放
     */
    function getFluidHostCss() {
        return `
            :host {
                display: block;
                width: 100%;
                height: 100%;
                overflow: auto;
            }
            * { box-sizing: border-box; }
            .widget-inner-content {
                width: 100%;
                height: 100%;
                min-height: 100%;
            }
            .widget-inner-content > *:not(style):not(script) {
                max-width: 100%;
            }
            .widget-inner-content > div:first-of-type,
            .widget-inner-content > section:first-of-type,
            .widget-inner-content > article:first-of-type,
            .widget-inner-content > main:first-of-type {
                width: 100%;
                min-height: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 2px; }
        `;
    }

    /**
     * 安装标准宿主铬层（拖动 / 缩放）。创建时必须调用。
     * @param {HTMLElement} widgetElement
     * @param {HTMLElement} gripElement
     */
    function installChrome(widgetElement, gripElement) {
        if (!widgetElement || !gripElement) {
            throw new Error('[WidgetStandards] installChrome requires widgetElement and gripElement');
        }

        const dragApi = getDragApi();
        if (!dragApi || typeof dragApi.setup !== 'function') {
            throw new Error('[WidgetStandards] drag.setup unavailable — load core/dragSystem.js first');
        }
        if (typeof dragApi.setupResize !== 'function') {
            throw new Error('[WidgetStandards] drag.setupResize unavailable — resize is required for all widgets');
        }

        if (widgetElement.dataset[CHROME_FLAG] === '1') {
            // 已安装则确保缩放手柄仍在（防止 DOM 被清掉）
            if (!widgetElement.querySelector('.desktop-widget-resize-handles')) {
                dragApi.setupResize(widgetElement);
            }
            return;
        }

        dragApi.setup(widgetElement, gripElement);
        dragApi.setupResize(widgetElement);
        widgetElement.dataset[CHROME_FLAG] = '1';
        widgetElement.classList.add('vcp-standard-chrome');
    }

    /**
     * 若标准铬层缺失则补装（复用已有挂件节点时调用）
     * @param {HTMLElement} widgetElement
     */
    function ensureChrome(widgetElement) {
        if (!widgetElement) return false;
        let grip = widgetElement.querySelector(':scope > .desktop-widget-grip');
        if (!grip) {
            grip = document.createElement('div');
            grip.className = 'desktop-widget-grip';
            widgetElement.insertBefore(grip, widgetElement.firstChild);
        }
        installChrome(widgetElement, grip);
        return true;
    }

    /**
     * 向 Shadow 根注入流体布局样式（幂等）
     * @param {object} widgetData
     */
    function ensureFluidHostStyles(widgetData) {
        if (!widgetData || !widgetData.shadowRoot) return;
        if (widgetData.shadowRoot.querySelector(`style[${FLUID_STYLE_ATTR}]`)) return;

        const style = document.createElement('style');
        style.setAttribute(FLUID_STYLE_ATTR, '1');
        style.textContent = getFluidHostCss();
        widgetData.shadowRoot.insertBefore(style, widgetData.shadowRoot.firstChild);
    }

    /**
     * 标注 widgetData 已具备的标准能力（供调试 / Agent 查询）
     * @param {object} widgetData
     */
    function annotate(widgetData) {
        if (!widgetData) return;
        widgetData.standardCapabilities = CAPABILITIES.map((c) => c.id);
        widgetData.hasStandardChrome = true;
    }

    /**
     * 一次性完成：铬层 + 流体样式 + 标注
     * @param {object} widgetData
     * @param {HTMLElement} gripElement
     */
    function applyAll(widgetData, gripElement) {
        if (!widgetData || !widgetData.element) {
            throw new Error('[WidgetStandards] applyAll requires widgetData.element');
        }
        installChrome(widgetData.element, gripElement);
        ensureFluidHostStyles(widgetData);
        annotate(widgetData);
    }

    window.VCPDesktop = window.VCPDesktop || {};
    window.VCPDesktop.widgetStandards = {
        CAPABILITIES,
        CHROME_FLAG,
        getFluidHostCss,
        installChrome,
        ensureChrome,
        ensureFluidHostStyles,
        annotate,
        applyAll,
        /**
         * Agent / 调试：列出宿主已自动提供的能力，避免重复实现
         */
        listCapabilities() {
            return CAPABILITIES.slice();
        },
    };
})();
