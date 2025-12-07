/**
 * 文本粒子生成优化类
 * 使用改进的算法生成更好的文本粒子效果
 */
export class TextParticleGenerator {
    constructor() {
        // 字体笔画数据（简化版本）
        this.strokeData = new Map();
        this.initializeStrokeData();

        // 文本配置
        this.config = {
            charWidth: 0.8,
            charHeight: 1.6,
            charSpacing: 0.3,
            lineWidth: 0.12,
            thickness: 0.2,
            particleDensity: 50, // 每个字符的粒子密度
            useCurves: true, // 使用曲线而不是直线
            addGlow: true, // 添加发光效果
            randomOffset: 0.02 // 随机偏移量
        };
    }

    /**
     * 初始化基本笔画数据
     */
    initializeStrokeData() {
        // 横线
        this.strokeData.set('horizontal', {
            type: 'line',
            start: [-0.4, 0],
            end: [0.4, 0]
        });

        // 竖线
        this.strokeData.set('vertical', {
            type: 'line',
            start: [0, -0.8],
            end: [0, 0.8]
        });

        // 点
        this.strokeData.set('dot', {
            type: 'point',
            radius: 0.08
        });

        // 撇
        this.strokeData.set('left-falling', {
            type: 'curve',
            start: [0.2, 0.8],
            control: [0, 0.4],
            end: [-0.2, -0.8]
        });

        // 捺
        this.strokeData.set('right-falling', {
            type: 'curve',
            start: [-0.2, 0.8],
            control: [0, 0.4],
            end: [0.2, -0.8]
        });
    }

    /**
     * 生成文本粒子位置
     * @param {string} text - 要显示的文本
     * @param {number} particleCount - 总粒子数
     * @param {number} particleIndex - 当前粒子索引
     * @returns {Object} 包含x, y, z坐标的对象
     */
    generateTextParticle(text, particleCount, particleIndex) {
        // 计算总宽度和起始位置
        const totalWidth = text.length * this.config.charWidth +
                          (text.length - 1) * this.config.charSpacing;
        const startX = -totalWidth / 2;

        // 根据粒子索引确定字符
        const progress = particleIndex / particleCount;
        const charIndex = Math.min(Math.floor(progress * text.length), text.length - 1);
        const char = text[charIndex];

        // 计算字符位置
        const charX = startX + charIndex * (this.config.charWidth + this.config.charSpacing);

        // 生成该字符的粒子位置
        const charLocalPos = this.generateCharacterParticle(char, particleCount, particleIndex);

        // 转换为全局位置
        return {
            x: charX + charLocalPos.x,
            y: charLocalPos.y,
            z: charLocalPos.z
        };
    }

    /**
     * 生成单个字符的粒子
     * @param {string} char - 字符
     * @param {number} totalParticles - 总粒子数
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 局部坐标
     */
    generateCharacterParticle(char, totalParticles, particleIndex) {
        const charInfo = this.getCharacterStrokes(char);
        if (!charInfo) {
            // 默认返回一个点
            return {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2,
                z: (Math.random() - 0.5) * this.config.thickness
            };
        }

        // 选择一个笔画
        const strokeIndex = Math.floor(Math.random() * charInfo.strokes.length);
        const stroke = charInfo.strokes[strokeIndex];

        // 在笔画上生成粒子
        const position = this.generateStrokeParticle(stroke, particleIndex);

        return position;
    }

    /**
     * 获取字符的笔画信息
     * @param {string} char - 字符
     * @returns {Object} 笔画信息
     */
    getCharacterStrokes(char) {
        const strokeDatabase = {
            'l': {
                strokes: [
                    { type: 'vertical', offset: [0, 0] },
                    { type: 'horizontal', offset: [-0.4, -0.8] }
                ]
            },
            'x': {
                strokes: [
                    { type: 'diagonal-left', offset: [0, 0] },
                    { type: 'diagonal-right', offset: [0, 0] }
                ]
            },
            'q': {
                strokes: [
                    { type: 'circle', offset: [0, 0] },
                    { type: 'diagonal-right', offset: [0.3, -0.3] }
                ]
            },
            'i': {
                strokes: [
                    { type: 'vertical', offset: [0, 0.2] },
                    { type: 'dot', offset: [0, 0.8] }
                ]
            },
            '你': {
                strokes: [
                    { type: 'vertical', offset: [-0.3, 0.4] },
                    { type: 'vertical', offset: [0.3, 0.4] },
                    { type: 'horizontal', offset: [0, -0.2] },
                    { type: 'box', offset: [0, -0.6] }
                ]
            },
            '好': {
                strokes: [
                    { type: 'vertical', offset: [-0.3, 0.4] },
                    { type: 'horizontal', offset: [-0.3, 0.2] },
                    { type: 'left-falling', offset: [0.3, 0.4] },
                    { type: 'right-falling', offset: [0.3, 0.4] },
                    { type: 'horizontal', offset: [0, -0.2] }
                ]
            }
        };

        return strokeDatabase[char.toLowerCase()];
    }

    /**
     * 在笔画上生成粒子
     * @param {Object} stroke - 笔画信息
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 粒子位置
     */
    generateStrokeParticle(stroke, particleIndex) {
        const offset = stroke.offset || [0, 0];

        switch (stroke.type) {
            case 'vertical':
                return this.generateLineParticle(
                    [offset[0], offset[1] - 0.8],
                    [offset[0], offset[1] + 0.8],
                    particleIndex
                );

            case 'horizontal':
                return this.generateLineParticle(
                    [offset[0] - 0.4, offset[1]],
                    [offset[0] + 0.4, offset[1]],
                    particleIndex
                );

            case 'diagonal-left':
                return this.generateLineParticle(
                    [offset[0] - 0.3, offset[1] + 0.8],
                    [offset[0] + 0.3, offset[1] - 0.8],
                    particleIndex
                );

            case 'diagonal-right':
                return this.generateLineParticle(
                    [offset[0] + 0.3, offset[1] + 0.8],
                    [offset[0] - 0.3, offset[1] - 0.8],
                    particleIndex
                );

            case 'circle':
                return this.generateCircleParticle(
                    offset[0], offset[1], 0.4, particleIndex
                );

            case 'dot':
                return {
                    x: offset[0] + (Math.random() - 0.5) * 0.1,
                    y: offset[1] + (Math.random() - 0.5) * 0.1,
                    z: (Math.random() - 0.5) * this.config.thickness
                };

            case 'box':
                return this.generateBoxParticle(
                    offset[0], offset[1], 0.5, 0.6, particleIndex
                );

            case 'left-falling':
                return this.generateCurveParticle(
                    [0.2, 0.8], [0, 0.4], [-0.2, -0.8],
                    offset, particleIndex
                );

            case 'right-falling':
                return this.generateCurveParticle(
                    [-0.2, 0.8], [0, 0.4], [0.2, -0.8],
                    offset, particleIndex
                );

            default:
                return {
                    x: (Math.random() - 0.5) * 0.2,
                    y: (Math.random() - 0.5) * 0.2,
                    z: (Math.random() - 0.5) * this.config.thickness
                };
        }
    }

    /**
     * 在直线上生成粒子
     * @param {Array} start - 起点 [x, y]
     * @param {Array} end - 终点 [x, y]
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 粒子位置
     */
    generateLineParticle(start, end, particleIndex) {
        const t = Math.random();
        const x = start[0] + (end[0] - start[0]) * t;
        const y = start[1] + (end[1] - start[1]) * t;

        return {
            x: x + (Math.random() - 0.5) * this.config.lineWidth,
            y: y + (Math.random() - 0.5) * this.config.lineWidth,
            z: (Math.random() - 0.5) * this.config.thickness
        };
    }

    /**
     * 在圆上生成粒子
     * @param {number} centerX - 圆心X
     * @param {number} centerY - 圆心Y
     * @param {number} radius - 半径
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 粒子位置
     */
    generateCircleParticle(centerX, centerY, radius, particleIndex) {
        const angle = Math.random() * Math.PI * 2;
        const r = radius + (Math.random() - 0.5) * this.config.lineWidth;

        return {
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
            z: (Math.random() - 0.5) * this.config.thickness
        };
    }

    /**
     * 在矩形上生成粒子
     * @param {number} centerX - 中心X
     * @param {number} centerY - 中心Y
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 粒子位置
     */
    generateBoxParticle(centerX, centerY, width, height, particleIndex) {
        const side = Math.floor(Math.random() * 4); // 选择哪条边
        let x, y;

        switch (side) {
            case 0: // 上边
                x = centerX + (Math.random() - 0.5) * width;
                y = centerY + height / 2;
                break;
            case 1: // 右边
                x = centerX + width / 2;
                y = centerY + (Math.random() - 0.5) * height;
                break;
            case 2: // 下边
                x = centerX + (Math.random() - 0.5) * width;
                y = centerY - height / 2;
                break;
            case 3: // 左边
                x = centerX - width / 2;
                y = centerY + (Math.random() - 0.5) * height;
                break;
        }

        return {
            x: x + (Math.random() - 0.5) * this.config.lineWidth,
            y: y + (Math.random() - 0.5) * this.config.lineWidth,
            z: (Math.random() - 0.5) * this.config.thickness
        };
    }

    /**
     * 在贝塞尔曲线上生成粒子
     * @param {Array} start - 起点
     * @param {Array} control - 控制点
     * @param {Array} end - 终点
     * @param {Array} offset - 偏移
     * @param {number} particleIndex - 粒子索引
     * @returns {Object} 粒子位置
     */
    generateCurveParticle(start, control, end, offset, particleIndex) {
        const t = Math.random();

        // 二次贝塞尔曲线公式
        const x = (1-t)*(1-t)*start[0] + 2*(1-t)*t*control[0] + t*t*end[0];
        const y = (1-t)*(1-t)*start[1] + 2*(1-t)*t*control[1] + t*t*end[1];

        return {
            x: offset[0] + x + (Math.random() - 0.5) * this.config.lineWidth,
            y: offset[1] + y + (Math.random() - 0.5) * this.config.lineWidth,
            z: (Math.random() - 0.5) * this.config.thickness
        };
    }

    /**
     * 更新粒子配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
}