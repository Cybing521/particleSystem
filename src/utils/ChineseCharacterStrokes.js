/**
 * 中文字符笔画数据库
 * 包含常用中文字符的笔画数据
 */
export const ChineseCharacterStrokes = {
    // 基本笔画类型
    strokeTypes: {
        // 横
        heng: { type: 'horizontal', start: [-0.4, 0], end: [0.4, 0] },
        // 竖
        shu: { type: 'vertical', start: [0, -0.8], end: [0, 0.8] },
        // 撇
        pie: { type: 'curve', start: [0.2, 0.8], control: [0, 0.4], end: [-0.2, -0.8] },
        // 捺
        na: { type: 'curve', start: [-0.2, 0.8], control: [0, 0.4], end: [0.2, -0.8] },
        // 点
        dian: { type: 'point', radius: 0.08 },
        // 提
        ti: { type: 'curve', start: [-0.3, -0.5], control: [0, -0.3], end: [0.3, 0] },
        // 钩
        gou: { type: 'hook', start: [0, 0.8], end: [0, 0], hook: [0.1, -0.2] },
        // 折
        zhe: { type: 'polyline', points: [[-0.4, 0], [0.4, 0], [0.4, 0.8]] }
    },

    // 常用字符数据
    characters: {
        // 数字
        '一': {
            strokes: [
                { type: 'heng', offset: [0, 0] }
            ],
            scale: 1.2
        },
        '二': {
            strokes: [
                { type: 'heng', offset: [0, -0.4] },
                { type: 'heng', offset: [0, 0.4] }
            ],
            scale: 1.2
        },
        '三': {
            strokes: [
                { type: 'heng', offset: [0, -0.6] },
                { type: 'heng', offset: [0, 0] },
                { type: 'heng', offset: [0, 0.6] }
            ],
            scale: 1.2
        },
        '四': {
            strokes: [
                { type: 'box', offset: [0, 0], width: 0.6, height: 0.8 },
                { type: 'heng', offset: [0, -0.3] },
                { type: 'shu', offset: [0, 0] },
                { type: 'heng', offset: [0, 0.3] }
            ],
            scale: 0.9
        },
        '五': {
            strokes: [
                { type: 'heng', offset: [0, -0.6] },
                { type: 'shu', offset: [-0.2, 0] },
                { type: 'zhe', offset: [-0.2, 0] },
                { type: 'heng', offset: [0, 0.6] }
            ],
            scale: 0.9
        },
        '六': {
            strokes: [
                { type: 'dian', offset: [-0.3, 0.6] },
                { type: 'heng', offset: [0, 0.2] },
                { type: 'pie', offset: [-0.2, -0.4] },
                { type: 'na', offset: [0.2, -0.4] }
            ],
            scale: 0.9
        },
        '七': {
            strokes: [
                { type: 'heng', offset: [0, 0.2] },
                { type: 'zhe', offset: [0.3, 0.2] }
            ],
            scale: 0.9
        },
        '八': {
            strokes: [
                { type: 'pie', offset: [-0.1, 0.3] },
                { type: 'na', offset: [0.1, 0.3] }
            ],
            scale: 0.9
        },
        '九': {
            strokes: [
                { type: 'pie', offset: [0.1, 0.6] },
                { type: 'gou', offset: [0, 0] }
            ],
            scale: 0.9
        },
        '十': {
            strokes: [
                { type: 'heng', offset: [0, 0] },
                { type: 'shu', offset: [0, 0] }
            ],
            scale: 1.0
        },

        // 常用字
        '人': {
            strokes: [
                { type: 'pie', offset: [-0.1, 0.3] },
                { type: 'na', offset: [0.1, 0.3] }
            ],
            scale: 1.0
        },
        '大': {
            strokes: [
                { type: 'heng', offset: [0, -0.5] },
                { type: 'pie', offset: [-0.1, 0] },
                { type: 'na', offset: [0.1, 0] }
            ],
            scale: 1.0
        },
        '小': {
            strokes: [
                { type: 'gou', offset: [0, 0.5] },
                { type: 'dian', offset: [-0.2, -0.3] },
                { type: 'dian', offset: [0.2, -0.3] }
            ],
            scale: 0.9
        },
        '中': {
            strokes: [
                { type: 'box', offset: [0, 0], width: 0.6, height: 0.9 },
                { type: 'shu', offset: [0, 0] },
                { type: 'heng', offset: [0, 0] }
            ],
            scale: 0.9
        },
        '国': {
            strokes: [
                { type: 'box', offset: [0, 0], width: 0.8, height: 1.0 },
                { type: 'gou', offset: [0, 0.3] },
                { type: 'dian', offset: [-0.2, -0.3] },
                { type: 'dian', offset: [0.2, -0.3] }
            ],
            scale: 0.9
        },
        '我': {
            strokes: [
                { type: 'pie', offset: [-0.3, 0.5] },
                { type: 'gou', offset: [-0.3, -0.2] },
                { type: 'vertical', offset: [0, 0.6] },
                { type: 'horizontal', offset: [0, 0.3] },
                { type: 'na', offset: [0.3, 0] }
            ],
            scale: 0.8
        },
        '你': {
            strokes: [
                { type: 'vertical', offset: [-0.3, 0.4] },
                { type: 'vertical', offset: [0.3, 0.4] },
                { type: 'horizontal', offset: [0, -0.2] },
                { type: 'box', offset: [0, -0.6], width: 0.5, height: 0.3 },
                { type: 'vertical', offset: [-0.2, -0.3] },
                { type: 'pie', offset: [0.1, -0.1] },
                { type: 'dian', offset: [0.3, -0.3] }
            ],
            scale: 0.8
        },
        '好': {
            strokes: [
                { type: 'vertical', offset: [-0.3, 0.4] },
                { type: 'horizontal', offset: [-0.3, 0.2] },
                { type: 'pie', offset: [0.3, 0.4] },
                { type: 'na', offset: [0.3, 0.4] },
                { type: 'horizontal', offset: [0, -0.2] },
                { type: 'horizontal', offset: [0, -0.5] },
                { type: 'vertical', offset: [0, 0] }
            ],
            scale: 0.8
        },
        '爱': {
            strokes: [
                { type: 'horizontal', offset: [0, -0.7] },
                { type: 'horizontal', offset: [0, -0.4] },
                { type: 'vertical', offset: [-0.3, -0.55] },
                { type: 'pie', offset: [0.3, -0.2] },
                { type: 'na', offset: [0.3, -0.2] },
                { type: 'box', offset: [0, 0.2], width: 0.6, height: 0.4 },
                { type: 'horizontal', offset: [0, 0.7] }
            ],
            scale: 0.7
        },
        '美': {
            strokes: [
                { type: 'horizontal', offset: [0, -0.8] },
                { type: 'vertical', offset: [-0.3, -0.6] },
                { type: 'vertical', offset: [0, -0.6] },
                { type: 'vertical', offset: [0.3, -0.6] },
                { type: 'horizontal', offset: [0, -0.4] },
                { type: 'pie', offset: [-0.2, 0] },
                { type: 'na', offset: [0.2, 0] },
                { type: 'horizontal', offset: [0, 0.4] },
                { type: 'horizontal', offset: [0, 0.8] }
            ],
            scale: 0.7
        }
    },

    /**
     * 获取字符的笔画数据
     * @param {string} char - 字符
     * @returns {Object} 笔画数据
     */
    getCharacterStrokes(char) {
        return this.characters[char] || null;
    },

    /**
     * 添加新的字符数据
     * @param {string} char - 字符
     * @param {Object} data - 笔画数据
     */
    addCharacter(char, data) {
        this.characters[char] = data;
    }
};