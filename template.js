/*!
 * mock_module - index.js
 */

/**
 * 模拟方法一
 * @param {String} path       输入路径
 * @param {Object} options    选项
 *  ```
 *  - {Interger} port
 *  - {String} host
 *  ```
 * @return {String|Object} 字符串形式或者对象形式,example:
 * ```
 *    {
 *      status: 200,
 *      error: '',
 *      path: '/test'
 *    } 
 * ```
 * @api public 
 */
exports.methodOne = function(){};

/**
 * 模拟方法二
 * @param {String} name       用户名`dead-horse`
 * @param {object} options     选项
 * @return {Boolean}
 * @api public 
 */
exports.methodSecond = function(){};
