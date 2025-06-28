1. 开发一个systemjs库构建文件的转换工具
2. 工具会发布到npm市场, 你需要确保脚本的通用型, 而不是仅仅针对exm*/bundle.js的转换
3. 除非你能百分百确定这个某个表达式模式是固定的, 否则不要使用正则表达式提取信息
4. 转成的ts文件内容应该是cocos creator ts项目文件格式 比如有@ccclass装饰器 @property(xxxx) 属性定义装饰器
5. 你需要同时检查HomeUI.unpacked.ts和BackPackUI.unpacked.ts文件的正确性,不能有方法丢失