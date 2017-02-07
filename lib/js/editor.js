(function (factory) {
    if (typeof window.define === 'function') {
        if (window.define.amd) {
            // AMD模式
            window.define(factory);
        } else if (window.define.cmd) {
            // CMD模式
            window.define(function (require, exports, module) {
                return factory;
            });
        } else {
            // 全局模式
            factory();
        }
    } else if (typeof module === "object" && typeof module.exports === "object") {
        // commonjs

        // 引用 css —— webapck
        require('../css/editor.min.css');
        module.exports = factory();
    } else {
        // 全局模式
        factory();
    }
})(function(){

	window.Edit = window.Edit || {};

	
	var instances = {};	    // 编辑器实例对象集合, key 是编辑器的容器id，用作对象销毁
	Edit.instants = {};     // 编辑器实例对象集合, 用作编辑器对象内部寻址
	Edit.commands = {};     // 公用命令对象，如 inserthtml
	Edit.customizeUI = {};  // 自定义UI

	var eid = 0;   // 编辑器对象ID
	var uid = 0;   // 编辑器组件ID，如button,menu
	var caches = {};   // 缓存区块

	/****************** 虚拟DOM创建 start ******************/
	function El(tagName,props,children,handles) {
		if (!(this.tagName = tagName)) return;
		var param, child;

		if (!handles) {
			if (utils.isObject(param = arguments[1]) && !utils.isFunction(param.click)) {
				this.props = param;
			} else if (utils.isArray(param)) {
				this.children = param;
			}  else {
				this.handles = param;
			}
			if (utils.isArray(child = arguments[2])) {
				this.children = child;
			} else {
				this.handles = child;
			}
		} else {
			this.props = props;
			this.children = children;
			this.handles = handles;
		}		
	}
	El.prototype.render = function() {
		var el = document.createElement(this.tagName),
			props = this.props || {},
			children = this.children || [],
			handles = this.handles || {};
		for (var prop in props) {
			if (props[prop]) {
				el.setAttribute(prop,props[prop]);
			}			
		}

		for (var handle in handles) {
			el.addEventListener(handle,handles[handle],false);
		}

		children.forEach(function(child){
			if (utils.isArray(child)) {
				child.forEach(function(item){
					item && (item instanceof HTMLElement ? el.appendChild(item) : el.insertAdjacentHTML('beforeend', item));
				})
			} else {
				child && (child instanceof HTMLElement ? el.appendChild(child) : el.insertAdjacentHTML('beforeend', child));
			}
		});
		return el;		
	};
	function createEl(tagName,props,children,handles) {
		return new El(tagName,props,children,handles).render();
	}
	/****************** 虚拟DOM创建 end ******************/

	/****************** 底层事件模块 start ******************/
	var Events = function(){};

	Events.prototype = {
		addListener: function(event,listener) {
			var self = this, events = event.split(' ');
			if (!this.hasOwnProperty('listeners')) {
				this.listeners || (this.listeners = {});
			};
			events.forEach(function(event){
				self.listeners[event] || (self.listeners[event] = []);
				self.listeners[event].push(listener);
			});
			return this;
		},
		on: function(event, listener) {
			return this.addListener(event,listener);
		},
		once: function(event,listener) {
			function handler(){
				this.removeListener(event,handler);
				return listener.apply(this,arguments);
			};
			return this.addListener(event,handler);
		},
		removeListener: function(event,listener) {
			var self = this, events, listeners, list;
			if (arguments.length === 0) {
				this.listeners = {};
				return this;
			};
			events = event.split(' ');
			events.forEach(function(event){
				list = (listeners = self.listeners) != null ? listeners[event] : void 0;
				if (!list) return;
				if (!listener) return delete self.listeners[event];
				list.forEach(function(event,i){
					if (!(event === listener)) return;
					list.splice(i, 1);
					self.listeners[event] = list;
				});
			});
			return this;
		},
		off: function(event,listener) {
			return this.removeListener(event,listener);
		},
		listenerList: function(event) {
			return this.listeners[event];
		},
		emit: function() {
			var self = this, args, listeners, event, list;
			args = arguments.length >= 1 ? [].slice.call(arguments,0) : [];
			event = args.shift();
			list = (listeners = this.listeners) != null ? listeners[event] : void 0;
			if (!list) return;
			list.forEach(function(event){
				event.apply(self, args);
			});
			return true;
		},
		// DOM 事件绑定
		bind: function(element, type, selector, handler, capture) {
			capture = !!capture;
			var types = utils.isArray(type) ? type : type.trim().split(/\s+/),
				length = types.length;
			if (length) {
				if (utils.isString(selector)) {		
					while (length--) {
						element.addEventListener(types[length], function(e){	
							utils.each(this.querySelectorAll(selector), function(item){
								(e.target === item || item.contains(e.target)) && handler.call(item,e);
							})
						}, capture);
					}
				} else {
					handler = !!handler;
					while (length--) {
						element.addEventListener(types[length], selector, handler);
					}
				}
			}
			element = null;            
		},
		// DOM 事件触发
		trigger: function(element, type) {
			var event = document.createEvent('HTMLEvents');
			event.initEvent(type, true, false);
			element.dispatchEvent(event);
		}
	}
	/****************** 底层事件模块 end ******************/


	/****************** 默认配置项 start ******************/
	// 语言包
	Edit.langs = {};
	Edit.langs['zh-ch'] = {        
        code: '源码',
        bold: '粗体',
        italic: '斜体',
        underline: '下划线',
        strikethrough: '删除线',
        forecolor: '文字颜色',
        backcolor: '背景色',
        removeformat: '清除格式',
        quotes: '引用',
        fontname: '字体',
        fontsize: '字号',
        heading: '标题',
        indent: '缩进',
        outdent: '取消缩进',
        insertorderedlist: '有序列表',
        insertunorderedlist: '无序列表',
        justifyleft: '左对齐',
        justifycenter: '居中对齐',
        justifyright: '右对齐',
        justifyfull: '两端对齐',
        createlink: '创建链接',
        insertimage: '图片',
        insertvideo: '视频',
        insertcode: '代码',
		undo: '撤销',
		redo: '重做'
    };	

	// 初始化配置
	var EDITOR_CONFIG = {
		serverUrl: 'http://www.daily.bookln.cn/comm/file/upload.do',
		serverBase64Url: 'http://www.daily.bookln.cn/comm/img/base64/upload.do',
		toolbars: ['code', '|', 'bold', 'italic', 'underline', 'strikethrough', 'forecolor', 'backcolor', 'removeformat', '|', 'quotes', 'fontname', 'fontsize', 'heading', 'indent', 'outdent', 
		'insertorderedlist', 'insertunorderedlist', 'justifyleft', 'justifycenter', 'justifyright', 'justifyfull', '|', 'createlink', 'insertimage', 'insertvideo', 'insertcode', '|', 'undo', 'redo'],
		fontnames: [
	            '宋体', '黑体', '楷体', '隶书', '幼圆', '微软雅黑', 'Arial', 
	            'Verdana', 'Georgia', 'Times New Roman', 'Microsoft JhengHei',
	            'Trebuchet MS', 'Courier New', 'Impact', 'Comic Sans MS'
	        ],
        colors: {'暗红色':'#880000', '紫色':'#800080', '红色':'#ff0000', '鲜粉色':'#ff00ff', '深蓝色':'#000080',
			'蓝色':'#0000ff', '湖蓝色':'#00ffff', '蓝绿色':'#008080', '绿色':'#008000', '橄榄色':'#808000',
			'浅绿色':'#00ff00', '橙黄色':'#ffcc00', '灰色':'#808080', '银色':'#c0c0c0', '黑色':'#000000', '白色':'#ffffff'
        },
        fontsizes: {'12px':1,'13px':2,'16px':3,'18px':4,'24px':5,'32px':6,'48px':7,},
        headings: {'标题1':'h1','标题2':'h2','标题3':'h3','标题4':'h4','标题5':'h5','标题6':'h6'},
        lang: Edit.langs['zh-ch'],
		resize: false,
		focus: true
	}	
	/****************** 默认配置项 end ******************/



	/******************  Edit 工具类 start  *****************/
	var utils = Edit.utils = {
		each: function(obj, iterator, context) {
			if (obj == null) return;
	        if (obj.length === +obj.length) {
	            for (var i = 0, l = obj.length; i < l; i++) {
	                if(iterator.call(context, obj[i], i, obj) === false)
	                    return false;
	            }
	        } else {
	            for (var key in obj) {
	                if (obj.hasOwnProperty(key)) {
	                    if(iterator.call(context, obj[key], key, obj) === false)
	                        return false;
	                }
	            }
	        }
		},
		map: function(obj, iterator, context) {
			if (obj == null) return;
			var result = [];
	        if (obj.length === +obj.length) {
	            for (var i = 0, l = obj.length; i < l; i++) {
	                result.push(iterator.call(context, obj[i], i, obj));
	            }
	        } else {
	            for (var key in obj) {
	                if (obj.hasOwnProperty(key)) {
	                    result.push(iterator.call(context, obj[key], key, obj));
	                }
	            }
	        }
	        return result;
		},
		extend: function(prop) {
			Array.prototype.slice.call(arguments, 1).forEach(function(source){
				for (var key in source) {
					if (source.hasOwnProperty(key)) {
						prop[key] = source[key];
					}					
				}
			});
			return prop;
		},
		inherits: function(subClass, superClass) {
			var oldP = subClass.prototype,
				newP = superClass.prototype;
			utils.extend(newP, oldP);
			subClass.prototype = newP;
			return (newP.constructor = subClass);
		},
		parseColor: function( val ){
			var r, g, b;
		    if( /rgb/.test(val) ){
		        var arr = val.match( /\d+/g );
		        r = parseInt( arr[0] );
		        g = parseInt( arr[1] );
		        b = parseInt( arr[2] );
		    } else if ( /#/.test(val) ){
		        var len = val.length;
		        if( len === 7 ){
		            r = parseInt( val.slice(1, 3), 16 );
		            g = parseInt( val.slice(3, 5), 16 );
		            b = parseInt( val.slice(5), 16 );
		        } else if ( len === 4 ){ 
		            r = parseInt( val.charAt(1) + val.charAt(1), 16 );
		            g = parseInt( val.charAt(2) + val.charAt(2), 16 );
		            b = parseInt( val.charAt(3) + val.charAt(3), 16 );
		        }
		    } else {
		        return val;
		    }
		    return { r: r, g: g, b: b }
		},
		parseUrl: function(name,query) {
			var reg = new RegExp("(^|&)"+ name +"=([^&]*)(&|$)"),r;
			if(query){
				var index = query.indexOf('?');
				if (index !== -1) query = query.substr(index+1);
				r = query.match(reg);
			}else{
				r = window.location.search.substr(1).match(reg);
			}
			if(r!=null)return decodeURI(r[2]); return null;
		},
		rangeEqual: function(newRange, oldRange) {
			var keys = 'collapsed commonAncestorContainer endContainer endOffset startContainer startOffset'.split(' ');
			var result = true;
			keys.forEach(function(key){
				if (newRange[key] !== oldRange[key]) return result = false;
			});
			return result;
		}
	};

	// 类型判断方法
	['String', 'Function', 'Array', 'Number', 'RegExp', 'Object', 'Date'].forEach(function(v){
		utils['is' + v] = function(obj) {
		    return {}.toString.call(obj) === "[object " + v + "]";
		}
	});	
	utils.extend(utils, Events.prototype);
	/******************  Edit 工具类 end  *****************/
	

	
	/******************  Edit UI类 start  *****************/
	var UI = Edit.ui = {
		createEl: createEl,
		offset: function(el) {
			if (Edit.utils.isString(el)) {
				el = document.getElementById(el);
			}
			var offset = el.getBoundingClientRect();
			return {left: offset.left, top: offset.top};	
		},
		getPanelOffset: function(id) {
			return 'position:absolute;left:'+this.offset(id).left+'px;top:'+(this.offset(id).top+this.height(id))+'px';
		},
		height: function(el) {
			if (Edit.utils.isString(el)) {
				el = document.getElementById(el);
			}
			return el.offsetHeight;
		},
		width: function(el) {
			if (Edit.utils.isString(el)) {
				el = document.getElementById(el);
			}
			return el.offsetWidth;
		},
		closePanel: function(ev) {
			var current = ev && ev.target || document;
			var panelWrap = document.getElementById('eui-panel-wrap');
	    	if (panelWrap && current !== panelWrap && !panelWrap.contains(current)) {
	    		panelWrap.parentNode.removeChild(panelWrap);
				document.body.style.overflow = 'visible';
	    	}    
		},
		closeDialog: function(ev) {
			var current = ev && ev.target || document;
			var dialogWrap = document.getElementById('eui-dialog-wrap');
	    	if (dialogWrap && current !== dialogWrap && !dialogWrap.contains(current)) {
	    		dialogWrap.parentNode.removeChild(dialogWrap);
				document.body.style.overflow = 'visible';
	    	}    
		},
		panelOffset: function(editor) {
			var panel = document.querySelector('.eui-panel');
			if (Edit.ui.offset(panel).left + panel.offsetWidth > Edit.ui.offset(editor.container).left + editor.container.offsetWidth) {
				panel.style.left = (Edit.ui.offset(editor.container).left + editor.container.offsetWidth - panel.offsetWidth)+ 'px';
			}
		},
		bodyNotScroll: function(event) {
            var scrollTop = this.scrollTop,
                scrollHeight = this.scrollHeight,
                height = this.clientHeight;

            var delta = (event.wheelDelta) ? event.wheelDelta : -(event.detail || 0);  
            if ((delta > 0 && scrollTop <= delta) || (delta < 0 && scrollHeight - height - scrollTop <= -1 * delta)) {
                this.scrollTop = delta > 0 ? 0 : scrollHeight;
                event.preventDefault();
            }        
		}
	};	

	// ui 公用方法
	UI.Stateful = {
		getDom: function() {
			var context = (this.content && this.content.ownerDocument || document)
			return context.getElementById(this.id);
		},
		removeDom: function() {
			var dom = this.getDom();
			dom.parentNode.removeChild(dom);
		},
		hasState: function(state) {
			return this.getDom().classList.contains('edui-state-' + state);
		},
		addState: function(state) {
			if (!this.hasState(state)) {
				this.getDom().classList.add('edui-state-' + state);
			}
		},
		removeState: function(state) {
			if (this.hasState(state)) {
				this.getDom().classList.remove('edui-state-' + state);
			}
		},
		isDisabled: function() {
			return this.hasState('disabled');
		},
		setDisabled: function(disabled) {
			if (disabled) {
				this.addState('disabled');
			} else {
				this.removeState('disabled');
			}
		},
		isChecked: function() {
			return this.hasState('checked');
		},
		setChecked: function(checked) {
			if (!this.isDisabled() && checked) {
				this.addState('checked');
			} else {
				this.removeState('checked');
			}
		}
	}
	// button 按钮
	UI.Button = function(options) {
		this.id = 'uid' + uid++;
		this.name = options.name;
		this.title = options.title;
		this.className= options.className;
		this.style = options.style;
		this.handles = options.handles;
	}
	UI.Button.prototype = {
		getHtmlTpl: function() {
			var self = this;
			return UI.createEl('li',{id:self.id,class:'editor-item',style:self.style,'data-title':self.title,draggable:true},[					
						UI.createEl('span',{class:'eicon '+self.className})	
					],self.handles);
		}
	}
	utils.extend(UI.Button.prototype, UI.Stateful);

	// 菜单栏弹出层
	UI.Panel = function(options) {
		this.id = 'uid' + uid++;
		this.content = options.content;
		this.handles = {
			
		};
	}
	UI.Panel.prototype = {
		getHtmlTpl: function() {
			return UI.createEl('div', {id:'eui-panel-wrap',class:'eui-panel-wrap'}, [this.content], this.handles);
		},
		show: function(fn) {
			var dom;
			document.body.appendChild(dom = this.getHtmlTpl());
			fn && fn();
			return dom;
		}
	}
	utils.extend(UI.Panel.prototype, UI.Stateful);

	// 弹出式选项框
	UI.Dialog = function(options) {
		this.id = 'uid' + uid++;
		this.title = options.title || '操作';
		this.content = options.content;
		this.confirm = options.confirm;		
		this.handles = {};
	}
	UI.Dialog.prototype = {
		getHtmlTpl: function() {
			return UI.createEl('div', {id:'eui-dialog-wrap',class:'eui-dialog-wrap'}, [
				UI.createEl('div',{class:'eui-dialog'}, [
					UI.createEl('div', {class: 'eui-dialog-title'}, [
						this.title,
						UI.createEl('div', {class: 'eui-dialog-close'}, [
							UI.createEl('span', {class: 'eicon eicon-close'}, {
								click: function(){UI.closeDialog()}
							})
						])
					]),					
					UI.createEl('div', {class: 'eui-dialog-content'}, [this.content]),
					this.confirm && UI.createEl('div',{class:'eui-dialog-handles'},[
						UI.createEl('span',{class:'eui-dialog-cancel'},['取消'],{click:function(){UI.closeDialog()}}),
						UI.createEl('span',{class:'eui-dialog-confirm'},['确定'],{click: this.confirm})
					])				
				])				
			], this.handles);
		},
		show: function(fn) {
			var dom;
			document.body.appendChild(dom = this.getHtmlTpl());
			fn && fn();
			return dom;
		}
	}
	utils.extend(UI.Dialog.prototype, UI.Stateful);

	// 次级弹出层
	UI.Popup = function(options) {
		this.id = 'uid' + uid++;
		this.content = options.content;
		this.handles = options.handles;
	}
	UI.Popup.prototype = {
		getHtmlTpl: function() {
			return UI.createEl('div',{id:this.id,class:'editor-popup'},[this.content],this.handles);
		},
		show: function(el) {
			var dom;
			el.appendChild(dom = this.getHtmlTpl());
			return dom;
		}
	}
	utils.extend(UI.Popup.prototype, UI.Stateful);
	/******************  Edit UI类 end  *****************/


	/******************  Edit 请求类(Ajax) start  *****************/
	var Ajax = Edit.Ajax = function (url, type, data, success, error) {
        if (!url) return;
        type = type.toUpperCase();

        var request = new XMLHttpRequest();
        request.open(type, url, true);

        request.onload = function () {
            if (this.status >= 200 && this.status < 400) {
                success && success(JSON.parse(this.response));
            } else {
                error && error(this.response);
            }
        };

        request.onerror = function () { error(this.response) };

        // type === 'POST' && request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        type === 'POST' ? request.send(data) : request.send();
    };
    /******************  Edit 请求类(Ajax) end  *****************/


    /******************  Edit 拓展(插件)机制 start  *****************/
	var plugin = Edit.plugin = function() {
		var _plugins = {};
		return {
			register: function(pluginName, fn) {
				_plugins[pluginName] = {
					optionName: pluginName,
					execFn: fn
				}
			},
			load: function(editor) {
				utils.each(_plugins, function(plugin){
					var _export = plugin.execFn.call(editor);
					if (_export) {
						utils.each(_export, function(v,k){
							switch(k.toLowerCase()) {
								case 'bindevents':
									utils.each(v, function(fn, eventName){
										editor.addListener(eventName, fn);
									});
									break;
								case 'commands': 
									utils.each(v, function(execfn,execName){
										editor.commands[execName] = execfn;
									});
							}
						});
					}
				});
			},
			run: function(pluginName,editor) {
				var plugin = _plugins[pluginName];
				if (plugin) {
					plugin.execFn.call(editor);
				}
			}
		}
	}();
	/******************  Edit 拓展(插件) start  *****************/	
	

	// 获取编辑器实例对象
	Edit.getEditor = function(id, opt) {
		var editor = instances[id];
		if (!editor) {
			editor = instances[id] = new Edit.Editor(opt);
			editor.render(id);
		}
		return editor;
	}

	// 删除编辑器实例对象
	Edit.delEditor = function (id) {
        var editor;
        if (editor = instances[id]) {
            editor.key && editor.destroy();
            delete instances[id];
			delete caches[id];
        }
    }

    // 注册编辑器组件
    Edit.registerUI = function(uiName,fn) {
    	utils.each(uiName.split(/\s+/), function(name) {
    		Edit.customizeUI[name] = {
    			execFn: fn
    		}
    	})
    }

    /******************  Edit 编辑器实例 start  *****************/
	var Editor = Edit.Editor = function(opt) {
		this.eid = eid++;
		this.commands = {};
		this.buttons = {};

		// 将公共配置导出，不要去改变其自身
		var tempOption = {};
		utils.each(EDITOR_CONFIG, function(val,key){
			tempOption[key] = val;
		});

		this.options = utils.extend(tempOption, opt),
		Edit.plugin.load(this);
		Edit.instants['editorInstant' + this.eid] = this;
	}	
	Editor.prototype = {
		// 注册命令
		registerCommand: function(name, obj) {
			this.commands[name] = obj;
		},
		// dom渲染成功回调
		ready: function(fn) {
			var self = this;
			if (fn) {
				self.isReady ? fn.apply(self) : self.addListener('ready', fn);
			}
		},
		// 初始化菜单栏
		initToolbar: function(container) {
			var self = this;

			var toolbars = this.options.toolbars || [];
			var toolbarUis = [];
			toolbars.forEach(function(item){
				var tool;
				if (item == '|') {
					tool = 'separator';
				} else {
					self.buttons[item] = tool = new Edit.ui[item](self);
				}
				toolbarUis.push(tool);
			});

			//接受外部定制的UI
            utils.each(Edit.customizeUI,function(obj,key){
                var tool;               
                tool = obj.execFn.call(self,self,key);
                if(tool){
                    self.buttons[key] = tool;
                    toolbarUis.push(tool);
                }
            });

			var toolbar = Edit.ui.createEl('ul',{class:'editor-toolbar'},{click:function(){self.emit('selectionchange')}});
			toolbarUis.forEach(function(item){
				var tool;
				if (item == 'separator') {
					tool = Edit.ui.createEl('li',{id:item.id,class:'editor-item editor-separator',draggable:true});
				} else {
					tool = item.getHtmlTpl();
				}				
				toolbar.appendChild(tool);
			});
			container.insertBefore(toolbar, container.firstChild);
		},
		// 编辑器操作区域渲染
		render: function(container) {
			if (!utils.isString(container)) return;
			var self = this,
				options = this.options || {};	
			self.key = container;
			container = document.getElementById(container);
			if (!container) return;
			caches[self.key] = {};
			self.options.initialContent = options.initialContent || container.innerHTML;
			container.innerHTML = '';
			var edUI = self.container = Edit.ui.createEl('div',{id: 'edui'+self.eid, class: 'editor-container'});			
			var html = [
				'<!DOCTYPE html>',
				'<html class=\'view\'>',
				'<head><meta charset=\'UTF-8\'><link rel=\'stylesheet\' href=\'\'>',
				'<style>',
					'html,body {margin:0; padding:0; word-wrap:break-word; cursor:text; height:100%;}',
					'body {padding: 8px; font-family: sans-serif; font-size: 14px;box-sizing:border-box;}',
					'p {margin: 5px 0}',
					'.editor-floatmenu{position:absolute;background:rgba(51,51,51,.9);;border:1px solid #f0f3f6;line-height:26px;border-radius:4px;overflow:hidden;}',
					'.editor-floatmenu>span{display:inline-block;padding:0 10px;cursor:pointer;color:#fff;font-size:12px;}',
					'.editor-floatmenu>span:hover{background:rgba(51,51,51,.9);}',
				'</style>',					
				'</head>',
				'<body class=\'view\'><p><br></p></body>',
				'<script id=\'_script\'>',
					'(function(){window.editor = window.parent.Edit.instants[\'editorInstant'+self.eid+'\'];editor.setup(document);})();',
					'var _script = document.getElementById(\'_script\');_script.parentNode.removeChild(_script);',
				'</script>',
				'</html>'
			].join('');
			edUI.appendChild(Edit.ui.createEl('iframe',{
				id: 'editor_' + self.eid,
				class: 'editor-iframe',
				src: 'javascript:void(function(){document.open();document.write("'+html+'");document.close();}())'
			}));
			container.appendChild(edUI);
			self.options.resize && edUI.appendChild(Edit.ui.createEl('span',{class:'eicon eicon-resize',style:'position:absolute;bottom:0;right:0;cursor:nwse-resize;font-size:12px;'},{'mousedown':function(e){
				var disY = e.clientY,
					disX = e.clientX,
					offset = container.getBoundingClientRect();
				function move(e) {
					var dW = container.offsetWidth + (e.clientX - container.offsetWidth - offset.left),
						dH = container.offsetHeight + (e.clientY - container.offsetHeight - offset.top);
					
					dH > 80 && (container.style.height = dH + 'px');
				}
				document.addEventListener('mousemove', move);
				document.addEventListener('mouseup', function(){
					this.removeEventListener('mousemove', move);
				});
				var Parent = document;
				edUI.querySelector('iframe').addEventListener('mouseover',function(){
					Parent.removeEventListener('mousemove', move);
				});
			}}));
		},
		setup: function(doc) {
			var self = this,
				options = self.options;
			doc.body.contentEditable = true;
			self.document = doc;
			self.window = doc.defaultView || doc.parentWindow;
			self.iframe = self.window.reameElement;
			self.body = doc.body;			
			self.initToolbar(self.container);			
			self.initEvents();					
			self.isReady = 1;
			self.emit('ready');
			self.options.initialContent && setTimeout(function(){self.setContent(self.options.initialContent);},0);
			self.options.focus && setTimeout(function(){self.focus();},0);
		},
		// 获取 html内容
		getContent: function() {
			var self = this;
			return self.filterContent();
		},
		// 获取文本内容
		getContentTxt: function() {
			var self = this;
			return self.body.textContent;
		},
		// 得到编辑器的纯文本内容，但会保留段落格式
		getPlainTxt: function() {
			var reg = new RegExp('\u200B', 'g'),
				$block = {address:1,blockquote:1,center:1,dir:1,div:1,dl:1,fieldset:1,form:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,hr:1,isindex:1,menu:1,noframes:1,ol:1,p:1,pre:1,table:1,ul:1};
			var html = this.body.innerHTML;
			html = html.replace(/<img[^>]*src\=\"([^>]+)\">/ig, function(match){
                    return match.replace(/src=\"([^>]+)\"/ig, function(){
                        return arguments[0].replace(/</ig, '&lt;');
                    });
                })
				.replace(/<(p|div)[^>]*>(<br\/?>|&nbsp;)<\/\1>/gi, '\n')
                .replace(/<br\/?>/gi, '\n')
                .replace(/<[^>/]+>/g, '')
                .replace(/(\n)?<\/([^>]+)>/g, function (a, b, c) {
                    return $block[c] ? '\n' : b ? b : '';
                });
            html = html.replace(/\s+?$/g, '');
            //取出来的空格会有c2a0会变成乱码，处理这种情况\u00a0
            return html.replace(reg, '').replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
		},
		// 设置内容
		setContent: function(html, isAppendTo) {
			var self = this;
			if (utils.isNumber(html)) html+='';
			html = html || '';
			self.body.innerHTML = (isAppendTo ? self.body.innerHTML : '') + html;
			caches[self.key].value = self.body.innerHTML;
			self.domFilter();
			var val = self.body.innerHTML;
			if (caches[self.key].value !== val) {
				self.emit('contentchange');
				caches[self.key].value = val;
			};
			self.focus();
		},
		// 命令执行
		callCmdFn: function(fnName, args) {
			var self = this,
				cmdName = args[0].toLowerCase(),
				cmd, cmdFn;
			cmd = this.commands[cmdName] || Edit.commands[cmdName];
			cmdFn = cmd && cmd[fnName];
			if (cmdFn) {
				return cmdFn.apply(this, args);
			}
		},
		// 命令入口
		execCommand: function(cmdName) {
			cmdName = cmdName.toLowerCase();
			var self = this,
				cmd = self.commands[cmdName] || Edit.commands[cmdName],
				result;
			if (!cmd || !cmd.execCommand) {
				return null;
			}
			self.restoreSelection();
			result = self.callCmdFn('execCommand', arguments);
			self.saveSelection();
			var val = self.body.innerHTML;
			if (caches[self.key].value !== val) {
				self.emit('contentchange');
				caches[self.key].value = val;
			};
			return result;
		},
		// 查询命令状态
		queryCommandState: function(cmdName) {
			return this.callCmdFn('queryCommandState', arguments);
		},
		// 查询命令当前值
		queryCommandValue: function(cmdName) {
			return this.callCmdFn('queryCommandValue', arguments);
		},
		// 初始化事件
		initEvents: function() {
			var self = this,
				doc = self.document,
				win = self.window;
			self.bind(doc, ['click', 'dblclick', 'keydown', 'input', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'selectstart', 'paste', 'compositionstart', 'compositionend'], self.proxyDomEvent.bind(self));
			self.bind(win, ['focus', 'blur'], self.proxyDomEvent.bind(self));
			self.bind(self.body, 'drop', function(e){
				var val = self.body.innerHTML;
				if (caches[self.key].value !== val) {
					self.emit('contentchange');
					caches[self.key].value = val;
				};
			});
			// code, blockquote, !p 的差异化操作
			self.on('keydown',function(ev){	
				// 强制换行：controlKey && enterKey	
				if (ev.ctrlKey && ev.keyCode === 13) {
					return self.execCommand('inserthtml','<p><br></p>');
				}  
				if (ev.keyCode === 13) {
					if (self.matchSelector(self.getRangeElem('pre'),'pre')) {
						ev.preventDefault();
						self.execCommand('inserthtml','\n');
					} else if (self.matchSelector(self.getRangeElem('blockquote'),'blockquote')) {
						ev.preventDefault();
						self.execCommand('inserthtml','<p><br></p>');
					} else if (self.matchSelector(self.getRangeElem('li'),'li')) {

					} else if (self.getRangeElem('p').nodeName !== 'P') {
						ev.preventDefault();
						self.execCommand('inserthtml','<p><br></p>');
					} 		
				} 
			});			
			// 删除内容时，判断是否剩余为空
			self.on('keyup', function(ev){
				if (ev.keyCode === 8) {
					var childs = self.body.childNodes;
					if (childs.length) {
						if (childs.length === 1 && !childs[0].childNodes.length) {
							self.body.innerHTML = '<p><br></p>';
						}
					} else {
						self.body.innerHTML = '<p><br></p>';
					}
				}				
			});

			self.selectionChange();
			self.contentChange();
			
			self.bind(doc,'mousedown',function(ev){
				Edit.ui.closePanel(ev);
			});
			self.bind(document, 'mousedown scroll', function(ev){
		    	Edit.ui.closePanel(ev);
		    });	
			if (self.options.events && utils.isObject(self.options.events)) {
				utils.each(self.options.events, function(fn, key){
					self.on(key,function(ev){
						fn(self);
					})
				})
			}	
		},
		// 事件代理
		proxyDomEvent: function(ev) {
			if(this.emit('before' + ev.type.replace(/^on/, '').toLowerCase()) === false){
                return false;
            }
            if(this.emit(ev.type.replace(/^on/, ''), ev) === false){
                return false;
            }
            return this.emit('after' + ev.type.replace(/^on/, '').toLowerCase());
		},	
		selectionChange: function() {
			var self = this, timeoutId;

			self.on('mouseup keyup paste', function(ev){
				if (ev.type == 'keyup' && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)) return;
                if (ev.button == 2) return;
				clearTimeout(timeoutId);
				timeoutId = setTimeout(function(){ self.saveSelection(); }, 100);
			});			
		},
		contentChange: function() {
			var self = this, timeoutId;	
			var comStart = false;
					
			function handler() {
				var val = self.body.innerHTML;
				if (caches[self.key].value !== val) {
					self.emit('contentchange');
					caches[self.key].value = val;
				};				
			}
			
			self.on('compositionstart', function(ev){
				comStart = true;
			});
			self.on('compositionend', function(ev){
				comStart = false;
				clearTimeout(timeoutId);
				timeoutId = setTimeout(handler, 100);
			});
			self.on('input paste', function(ev){
				if (comStart) return;
				clearTimeout(timeoutId);
				timeoutId = setTimeout(handler, 100);
			});
		},
		// 编辑器获取焦点	
		focus: function() {
			var self = this;
		    var range = self.document.createRange();
			var node = self.body.lastChild;
		    range.setStart(node, node.childNodes.length);
		    range.collapse(true);
		    var selection = self.document.getSelection();
		    selection.removeAllRanges();
		    selection.addRange(range);
		    self.body.focus();
		    self.saveSelection();
		},
		// dom过滤
		domFilter: function() {
			var self = this;
			var child = self.body.firstChild, tmpNode;
			if (!child) {
				self.body.innerHTML = '<p><br></p>';
			} else {
				var p = self.document.createElement('p');
				while (child) {
					while (child && (child.nodeType == 3 || child.nodeName.toLowerCase() === 'img')) {
						tmpNode = child.nextSibling;
						p.appendChild(child);
						child = tmpNode;
					}
					if (p.firstChild) {
						if (!child) {
							self.body.appendChild(p);
							break;
						} else {
							child.parentNode.insertBefore(p, child);
							p = self.document.createElement('p');
						}
					}
					child = child.nextSibling;
				}
			}
		},
		// 过滤编辑区内容
		filterContent: function() {
			var self = this;
			var nodes = self.body.childNodes;
			if (nodes.length === 1) {
				var childs = nodes[0].childNodes;
				if (childs.length === 1 && childs[0].nodeName.toLowerCase() === 'br') {
					return '';
				}
			}
			return self.body.innerHTML;
		},
		// 获取编辑区域光标位置
		getCurrentRange: function() {
			return this.document.getSelection().getRangeAt(0);
		},
		getRangeElem: function(elName) {
			var range = this.getCurrentRange();
			if (!range) return;
			var dom = range.commonAncestorContainer;
			if (elName) {
				while(dom) {
					if (dom.nodeName.toLowerCase() === elName) {
						return dom;
					}
					dom = dom.parentNode;
				}
				return this.body;
			} else {
				if (dom.nodeType === 1) {
					return dom;
				} else {
					return dom.parentNode;
				}
			}			
		},
		matchSelector: function (element, selector) {
            var match =
				document.documentElement.matchesSelector ||
                document.documentElement.webkitMatchesSelector ||
                document.documentElement.mozMatchesSelector ||
                document.documentElement.msMatchesSelector ||
                function (selector, element) {
                    if (element.tagName === selector.toUpperCase()) return true;

                    var elements = document.querySelectorAll(selector),
                        length = elements.length;

                    while (length--) {
                        if (elements[length] === this) return true;
                    }
                    return false;
                };

            // 重写函数自身，使用闭包keep住match函数，不用每次都判断兼容
            this.matchSelector = function (element, selector) {
                return match.call(element, selector);
            };

            return this.matchSelector(element, selector);
        },
		// 保存编辑区域光标位置
		saveSelection: function(ev) {
			var currentRange = this.getCurrentRange();
			if (!currentRange) return;
			if (!this.currentRange) {
				this.emit('selectionchange');
			// 已存在选区的情况下，只有发生变化，才会触发相应事件
			} else if (this.currentRange && !utils.rangeEqual(currentRange, this.currentRange)) {
				this.emit('selectionchange');
			}
			this.currentRange = currentRange;
		},
		// 恢复编辑区域光标位置
		restoreSelection: function() {
			var self = this;
			if (!self.currentRange) return;
			var selection, range;
			selection = self.document.getSelection();
			selection.removeAllRanges();
			selection.addRange(self.currentRange);
			self.body.focus();
		},
		// 销毁编辑器实例
		destroy: function() {
			var self = this;
			self.emit('destroy');
			var container = self.container.parentNode;
			var key = self.key;
			container.parentNode.removeChild(container);	
			delete Edit.instants['editorInstant' + self.eid];
			for (var k in self) {
                if (self.hasOwnProperty(k)) {
                    delete self[k];
                }
            }
			Edit.delEditor(key);		
		},
		// 清除内容
		clear: function() {
			this.body.innerHTML = '<p><br></p>';
		},
		// 内容是否为空
		isEmpty: function() {
			return this.filterContent() ? false : true;
		}
	};
	utils.inherits(Editor,Events);
	/******************  Edit 编辑器实例 end  *****************/


	// 命令：插入html片段
	Edit.commands['inserthtml'] = {
		execCommand: function(command, html) {
			var self = this;
			self.document.execCommand('inserthtml',false,html);
		}
	}	

	// 命令：直接操作式
	var btnCmds = ['bold', 'italic', 'underline', 'strikethrough', 'removeformat', 'indent', 'outdent', 'quotes', 'insertorderedlist',
	 'insertunorderedlist', 'justifyleft', 'justifycenter', 'justifyright', 'justifyfull'];		
    btnCmds.forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function() {
				this.document.execCommand(cmd,false,null);
			},
			queryCommandState: function() {
				return this.document.queryCommandState(cmd);
			}
		}
    	Edit.ui[cmd] = function(editor) {  		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
	    				editor.execCommand(cmd);
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandState(cmd);
    			if (!state) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    });

    // 命令：字体颜色、背景颜色
    ['forecolor','backcolor'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.document.execCommand(c,false,v);					
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {   		

			var colors = Edit.utils.map(editor.options.colors, function(v,k){
				var color = Edit.utils.parseColor(v);
				return 'rgb('+color.r+','+color.g+','+color.b+')'; 
			});

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Panel({
				    		content: Edit.ui.createEl('ul',{class:'menu-list menu-colors',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options.colors,function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key},[Edit.ui.createEl('span',{class:'eicon eicon-'+cmd,style:'color:'+val})],{click:function(ev){editor.execCommand(cmd,val);Edit.ui.closePanel();}})
				    		}),{
								mousewheel: Edit.ui.bodyNotScroll
							})
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);      			
				if (colors.indexOf(state.replace(/\s+/g,'')) != -1) {
					ui.setChecked(true);
				} else {
					ui.setChecked(false);
				}		
    		});
    		return ui;
    	}
    });

    // 命令：标题 h1-h6
    ['heading'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.document.execCommand('formatblock',false,v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState('formatblock');
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue('formatblock');
			}
		};
    	Edit.ui[cmd] = function(editor) {    	

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Panel({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key},[Edit.ui.createEl(val,[key])],{click:function(ev){editor.execCommand(cmd,val);Edit.ui.closePanel();}})
				    		}), {
								mousewheel: Edit.ui.bodyNotScroll
							})
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);
    			if (!/h+/.test(state)) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    });

    // 命令：字体名称
    ['fontname'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.document.execCommand(c,false,v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {       		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Panel({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:val},[Edit.ui.createEl('span',{style:'font-family:'+val+''},[val])],{click:function(ev){editor.execCommand(cmd,val);Edit.ui.closePanel();}})
				    		}),{
								mousewheel: Edit.ui.bodyNotScroll
							})
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);
    			if (state === 'sans-serif') {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    });

    // 命令：字体大小
    ['fontsize'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.document.execCommand(c,false,v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {      		

			var sizes = Edit.utils.map(editor.options.fontsizes, function(v,k){
				return v+'';
			});

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Panel({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key,style:'font-size:'+key},[key],{click:function(ev){editor.execCommand(cmd,val);Edit.ui.closePanel();}})
				    		}), {
								mousewheel: Edit.ui.bodyNotScroll
							})
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);
    			if (sizes.indexOf(state) != -1) {
    				ui.setChecked(true);
    			} else {
    				ui.setChecked(false);
    			}
    		});
    		return ui;
    	}
    }); 

    // 命令：显示源码
    ['code'].forEach(function(cmd){
    	Edit.ui[cmd] = function(editor) {    		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				if (!ui.isChecked()) {
	    					editor.saveSelection();
	    					editor.body.contentEditable = false;
	    					editor.body.textContent = editor.body.innerHTML;
	    					ui.setChecked(true);
	    					Edit.utils.each(editor.buttons,function(v,k){
	    						if (v != ui) {
	    							v.setDisabled(true);
	    						}
	    					});
	    				} else {
	    					editor.body.innerHTML = editor.body.textContent;
	    					editor.body.contentEditable = true;
	    					ui.setChecked(false);
	    					editor.restoreSelection();
	    					editor.body.focus();
	    					Edit.utils.each(editor.buttons,function(v,k){
	    						if (v != ui) {
	    							v.setDisabled(false);
	    						}
	    					});
	    				}
	    			}
    			}
    		}); 
    		return ui;
    	}
    }); 
 
    // 命令：插入代码
    ['insertcode'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				var editor = this;
				var dom = editor.getRangeElem('pre');
				var isPre = editor.matchSelector(dom,'pre');
				if (isPre) {
					var html = dom.innerHTML;
					dom.parentNode.removeChild(dom);
					if (html !== '<br>') {
						this.execCommand('inserthtml','<p><br>'+ html +'</p><p><br></p>');
						var p = editor.getRangeElem().previousSibling;
						p.removeChild(p.firstChild);
					} else {
						this.execCommand('inserthtml','<p><br></p>');
					}
					Edit.utils.each(editor.buttons,function(v,k){
						v.setDisabled(false);
					});			

				} else {
					this.execCommand('inserthtml','<pre style="border: 1px solid #f0f3f6;background:#f8f8f8;padding:10px;margin:5px 0;font-size:.8em;border-radius:3px;"><br></pre>');
					var pre = editor.getRangeElem();
					var p = this.document.createElement('p');
					p.innerHTML = '<br>';						
					var nextNode = pre.nextSibling;
					if (!nextNode) {
						pre.parentNode.appendChild(p)
					}
					Edit.utils.each(editor.buttons,function(v,k){
						if (v != editor.buttons[cmd]) {
							v.setDisabled(true);
						}							
					});			
				}					
			},
			queryCommandState: function(c,v) {
				return this.matchSelector(this.getRangeElem('pre'),'pre');
			}
		};
    	Edit.ui[cmd] = function(editor) {      		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
						editor.execCommand(cmd);								
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandState(cmd);
    			if (!state) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
			// 插入code时，其它button禁用
			editor.addListener('mouseup', function(ev){
				if (editor.matchSelector(editor.getRangeElem('pre'),'pre')) {
					Edit.utils.each(editor.buttons,function(v,k){
						if (v != editor.buttons['insertcode']) {
							v.setDisabled(true);
						}							
					});
				} else if (editor.buttons.code && !editor.buttons.code.isChecked()) {
					Edit.utils.each(editor.buttons,function(v,k){
						v.setDisabled(false);
					});
				} 
			});
			
    		return ui;
    	}
    }); 

	// 命令：插入引用
    ['quotes'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				var editor = this;
				var dom = editor.getRangeElem('blockquote');
				var isQuote = editor.matchSelector(dom,'blockquote');
				if (isQuote) {
					var html = dom.innerHTML;
					dom.parentNode.removeChild(dom);
					if (html !== '<p><br></p>') {
						this.execCommand('inserthtml',html+'<p><br></p>');
					} else {
						this.execCommand('inserthtml','<p><br></p>');
					}						
				} else {
					this.execCommand('inserthtml','<blockquote style="border-left:8px solid #d0e5f2;padding:5px 10px;margin:10px 0;line-height:1.4;font-size:100%;background-color:#f1f1f1;"><p><br></p></blockquote>');
					var quote = editor.getRangeElem('blockquote');
					var p = this.document.createElement('p');
					p.innerHTML = '<br>';						
					var nextNode = quote.nextSibling;
					if (!nextNode) {
						quote.parentNode.appendChild(p)
					}
				}		
			},
			queryCommandState: function(c,v) {
				return this.matchSelector(this.getRangeElem('blockquote'),'blockquote');
			}
		};
    	Edit.ui[cmd] = function(editor) {    		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
						editor.execCommand(cmd);
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandState(cmd);
    			if (!state) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    }); 

    // 命令：创建链接
    ['createlink'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.document.execCommand(c,false,v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {       		

			function insertLink() {
				var href = document.getElementById('input-link').value;
				if (href) {
					editor.execCommand(cmd,href);
					Edit.ui.closeDialog();
				}
			}

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
	    				var ce = Edit.ui.createEl;
		    			var menu = new Edit.ui.Dialog({
							title: '插入链接',
							confirm: insertLink,
				    		content: ce('div',{class:'link-wrap'},[					    			
								ce('div',{class:'panel-content'},[	
									ce('input',{id:'input-link',class:'input-text',type:'text',placeholder:'http://'})
								])
							])
				    	});
		    			menu.show();
		    			setTimeout(function(){
							document.getElementById('input-link').focus();
						},0);
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(type){
    			var state = editor.queryCommandValue(cmd);
    			if (!state) {
    				ui.setChecked(false);
    				// ui.setDisabled(true);
    			} else {
    				ui.setChecked(true);
    				// ui.setDisabled(false);
    			}
    		});
    		return ui;
    	}
    }); 

    // 命令：插入图片
    ['insertimage'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.execCommand('inserthtml',v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {     		

			function sendAndInsertFile(ev) {
				var file = this.files[0];
				var rFilter = /^(image\/bmp|image\/gif|image\/jpeg|image\/png|image\/jpg)$/i;
    			var url = editor.options.serverUrl;
    			var loadingId = 'loading_' + (+new Date()).toString(36);
    			var Form = new FormData();
    			Form.append('file', file);
				Form.append('imgInfo', true);
    			editor.execCommand('inserthtml', '<img id="'+ loadingId +'" src="/lib/images/loading.gif" style="max-width:100% !important;height:auto;">');
    			if (rFilter.test(file.type)) {
    				Edit.Ajax(url,'post',Form,function(cb){
    					var loader = editor.document.getElementById(loadingId);
						loader.setAttribute('src',cb.data.url);
						if (cb.data.height) loader.setAttribute('height',cb.data.height);
						if (cb.data.width) loader.setAttribute('width',cb.data.width);
						loader.removeAttribute('id');
    					Edit.ui.closeDialog();
						// 监听内容变化
						var val = editor.body.innerHTML;
						if (caches[editor.key].value !== val) {
							editor.emit('contentchange');
							caches[editor.key].value = val;
						}						
    				})
    			}
			}

			function insertImg() {
				var src = document.getElementById('input-src').value;
				if (src) {
					editor.execCommand('inserthtml', '<img src="'+ src +'" style="max-width:100%;height:auto;">');
					Edit.ui.closeDialog();
				}
			}

			function insertImgEvent() {
				var labs = Array.prototype.slice.call(document.querySelectorAll('.panel-tab-btn'));
				labs.forEach(function(item){
					item.addEventListener('click',function(){
						labs.forEach(function(i){
							i.classList.remove('selected');
						})
						this.classList.add('selected');
						if (this.getAttribute('for') === 'img-url') {
							setTimeout(function(){
								document.getElementById('input-src').focus();
							},0);
						}
					})
				});				
			}

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
	    				var ce = Edit.ui.createEl;
						var menu = new Edit.ui.Dialog({
							title: '插入图片',
							confirm: insertImg,
							content: ce('div',{class:'img-wrap'},[
								ce('div',{class:'label-box'},[
									ce('label',{class:'panel-tab-btn selected', for: 'img-file'},['上传图片']),
									ce('label',{class:'panel-tab-btn', for: 'img-url'},['网络图片'])
								]),
								ce('div',{class:'panel-content'},[
									ce('input',{class:'panel-tab-radio',id:'img-file',type:'radio',name:'radio',checked:true}),
									ce('div',{class:'panel-tab-content'},[
										ce('label',{class:'eicon eicon-upload',for:'upload'}),
										ce('input',{id:'upload',class:'upload',type:'file'},{change:sendAndInsertFile})
									]),
									ce('input',{class:'panel-tab-radio',id:'img-url',type:'radio',name:'radio'}),
									ce('div',{class:'panel-tab-content'},[
										ce('input',{id:'input-src',class:'input-text',type:'text',placeholder:'http://'})									
									])
								])
							])
						});
		    			menu.show(insertImgEvent);
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);
    			if (!state) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    }); 

    // 命令：插入视频
    ['insertvideo'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c,v) {
				this.execCommand('inserthtml',v);
			},
			queryCommandState: function(c,v) {
				return this.document.queryCommandState(c);
			},
			queryCommandValue: function(c,v) {
				return this.document.queryCommandValue(c);
			}
		};
    	Edit.ui[cmd] = function(editor) {     		
			
			function videoFilter(src) {
				if (!src) return;	
				var types = {
					'mp4': 'video/mp4',
					'ogg': 'video/ogg',
					'webm': 'video/webm'
				}			
				var index = src.lastIndexOf('.'),
					length = src.length;
				var type = src.substring(index, length);
				if (types[type]) {
					return '<source src="'+ src +'" type="'+ type +'">';
				} else {
					return '<source src="'+ src +'">';
				}
			}

			function insertVideo() {
				var src = document.getElementById('input-src').value;
				if (src) {
					var source = videoFilter(src),
						width = document.getElementById('input-v-width').value,
						height = document.getElementById('input-v-height').value,
						video = [
							'<video width="'+ width +'px" height="'+ height +'px" controls>',
							source,
							'</video>'
						].join('');
					editor.execCommand(cmd,video);
					Edit.ui.closeDialog();
				}
			}

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
	    				var ce = Edit.ui.createEl;
		    			var menu = new Edit.ui.Dialog({
							title: '插入视频',
							confirm: insertVideo,
				    		content: ce('div',{class:'video-wrap'},[	
								ce('input',{id:'input-src',class:'input-text',type:'text',placeholder:'.mp4/.ogg/.webm'}),
								ce('div',{class:'panel-props',style:'margin-top:10px;'},[
									'宽',
									ce('input',{id:'input-v-width',class:'input-text',type:'text',style:'width:40px;margin:0 5px;text-align:center;',value:'320'}),
									'px',
									ce('span',{class:'editor-space',style:'width:20px;'}),
									'高',
									ce('input',{id:'input-v-height',class:'input-text',type:'text',style:'width:40px;margin:0 5px;text-align:center;',value:'240'}),
									'px',
								])
							])
				    	});
		    			menu.show();
		    			setTimeout(function(){
								document.getElementById('input-src').focus();
							},0);
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(){
    			var state = editor.queryCommandValue(cmd);
    			if (!state) {
    				ui.setChecked(false);
    			} else {
    				ui.setChecked(true);
    			}
    		});
    		return ui;
    	}
    });

	// 命令： 撤销/重做
	['undo', 'redo'].forEach(function(cmd){
		Edit.commands[cmd] = {
			execCommand: function(c) {
				this.document.execCommand(cmd,false,null);
			}
		}
		Edit.ui[cmd] = function(editor) {  		

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
	    				editor.execCommand(cmd);
	    			}
    			}
    		}); 
    		return ui;
    	}
	});

    // 拓展：粘贴图片
    plugin.register('autouplod', function(){
    	function getPasteImage(e){
	        return e.clipboardData && e.clipboardData.items && e.clipboardData.items.length == 1 && /^image\//.test(e.clipboardData.items[0].type) ? e.clipboardData.items:null;
	    }
	    function getDropImage(e){
	        return  e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files:null;
	    }

	    function sendAndInsertFile(file,editor) {
			var url = editor.options.serverBase64Url;
			if (url) {
				var Form = new FormData();
				var loadingId = 'loading_' + (+new Date()).toString(36);
				Form.append('data', file);
				editor.execCommand('inserthtml', '<img id="'+ loadingId +'" src="/lib/images/loading.gif" style="max-width:100%;height:auto;">');
				
				Edit.Ajax(url,'post',Form,function(cb){
					var loader = editor.document.getElementById(loadingId);
					loader.setAttribute('src',cb.data.url);
					loader.removeAttribute('id');
					Edit.ui.closePanel();
				});
			} else {
				editor.execCommand('inserthtml', '<img style="max-width:100%;height:auto;" src="'+ file +'">');
			}
	    }

	    return {
	    	 bindEvents:{
	            //插入粘贴板的图片，拖放插入图片
	            'ready':function(e){
	                var self = this;
	                if(window.FormData && window.FileReader) {
	                    self.bind(self.body, 'paste drop', function(e){
	                        var hasImg = false,
	                            items;
	                        //获取粘贴板文件列表或者拖放文件列表
	                        items = e.type == 'paste' ? getPasteImage(e):getDropImage(e);
	                        if(items){
	                            var len = items.length,
	                                file;
	                            while (len--){
	                                file = items[len];
	                                if(file.getAsFile) file = file.getAsFile();
	                                if(file && file.size > 0) {	                                    
	                                    hasImg = true;
	                                    var reader = new FileReader();
										reader.onload = function (event) {
											var base64_str = event.target.result;
											sendAndInsertFile(base64_str,self);
										}
										reader.readAsDataURL(file);  
	                                }
	                            }
	                            hasImg && e.preventDefault();
	                        }

	                    });
	                    //取消拖放图片时出现的文字光标位置提示
	                    self.bind(self.body, 'dragover', function (e) {
	                        if(e.dataTransfer.types[0] == 'Files') {
	                            e.preventDefault();
	                        }
	                    });
	                    
	                }
	            }
	        }
	    }
    });

	return window.Edit;
});