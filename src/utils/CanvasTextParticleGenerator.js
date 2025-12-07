/**
 * 使用Canvas渲染文字到粒子的生成器
 * 支持任意字体，包括中文字符
 */
export class CanvasTextParticleGenerator {
    constructor() {
        // 创建离屏Canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        // 配置
        this.config = {
            fontSize: 80,
            fontFamily: 'Arial, "Microsoft YaHei", "SimHei", sans-serif',
            particleDensity: 0.5, // 每个像素的粒子密度
            threshold: 128, // 像素阈值（0-255）
            useGlow: false,
            glowRadius: 2,
            padding: 20
        };

        // 缓存已渲染的文字
        this.cache = new Map();
    }

    /**
     * 生成文本粒子位置
     * @param {string} text - 要显示的文本
     * @param {number} particleCount - 总粒子数
     * @param {number} particleIndex - 当前粒子索引
     * @returns {Object} 包含x, y, z坐标的对象
     */
    generateTextParticle(text, particleCount, particleIndex) {
        // 获取或渲染文字的像素数据
        const pixelData = this.getTextPixels(text);

        if (!pixelData || pixelData.positions.length === 0) {
            // 如果没有像素数据，返回默认位置
            return {
                x: (Math.random() - 0.5) * text.length * 0.8,
                y: (Math.random() - 0.5) * 1.6,
                z: (Math.random() - 0.5) * 0.2
            };
        }

        // 从像素位置中随机选择
        const positionIndex = Math.floor(Math.random() * pixelData.positions.length);
        const position = pixelData.positions[positionIndex];

        return {
            x: position.x,
            y: position.y,
            z: (Math.random() - 0.5) * 0.2 // 添加一些深度
        };
    }

    /**
     * 获取文字的像素数据（带缓存）
     * @param {string} text - 文字
     * @returns {Object} 包含位置数组和尺寸的对象
     */
    getTextPixels(text) {
        // 检查缓存
        const cacheKey = `${text}_${this.config.fontSize}_${this.config.fontFamily}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 设置Canvas尺寸
        this.ctx.font = `bold ${this.config.fontSize}px ${this.config.fontFamily}`;
        const textMetrics = this.ctx.measureText(text);

        const width = Math.ceil(textMetrics.width) + this.config.padding * 2;
        const height = this.config.fontSize + this.config.padding * 2;

        this.canvas.width = width;
        this.canvas.height = height;

        // 重新设置字体（Canvas大小改变后需要重新设置）
        this.ctx.font = `bold ${this.config.fontSize}px ${this.config.fontFamily}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // 清除画布
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, width, height);

        // 绘制文字
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(text, width / 2, height / 2);

        // 如果需要发光效果
        if (this.config.useGlow) {
            this.ctx.shadowColor = 'white';
            this.ctx.shadowBlur = this.config.glowRadius;
            this.ctx.fillText(text, width / 2, height / 2);
        }

        // 获取像素数据
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // 提取位置
        const positions = [];
        const centerX = width / 2;
        const centerY = height / 2;

        for (let y = 0; y < height; y += Math.max(1, Math.floor(1 / this.config.particleDensity))) {
            for (let x = 0; x < width; x += Math.max(1, Math.floor(1 / this.config.particleDensity))) {
                const index = (y * width + x) * 4;
                const alpha = pixels[index + 3];

                // 如果像素不透明度超过阈值
                if (alpha > this.config.threshold) {
                    // 转换为以文字中心为原点的坐标
                    const posX = (x - centerX) / this.config.fontSize;
                    const posY = -(y - centerY) / this.config.fontSize; // Y轴翻转

                    positions.push({ x: posX, y: posY });
                }
            }
        }

        const result = {
            positions,
            width: width / this.config.fontSize,
            height: height / this.config.fontSize
        };

        // 缓存结果
        this.cache.set(cacheKey, result);

        return result;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.clearCache(); // 配置改变后清除缓存
    }

    /**
     * 获取文字的预估尺寸
     * @param {string} text - 文字
     * @returns {Object} 包含宽度和高度的对象
     */
    getTextSize(text) {
        this.ctx.font = `bold ${this.config.fontSize}px ${this.config.fontFamily}`;
        const metrics = this.ctx.measureText(text);

        return {
            width: metrics.width / this.config.fontSize,
            height: 1
        };
    }
}