
(function(){

	window.Edit = window.Edit || {};

	
	var instances = {};	    // 编辑器实例对象集合, key 是编辑器的容器id，用作对象销毁
	Edit.instants = {};     // 编辑器实例对象集合, 用作编辑器对象内部寻址
	Edit.commands = {};     // 公用命令对象，如 inserthtml
	Edit.customizeUI = {};  // 自定义UI

	var eid = 0;   // 编辑器对象ID
	var uid = 0;   // 编辑器组件ID，如button,menu


	/****************** 虚拟DOM创建 start ******************/
	function El(tagName,props,children,handles) {
		if (!(this.tagName = tagName)) return;
		var param, children;

		if (!handles) {
			if (utils.isObject(param = arguments[1]) && !utils.isFunction(param.click)) {
				this.props = param;
			} else if (utils.isArray(param)) {
				this.children = param;
			}  else {
				this.handles = param;
			}
			if (utils.isArray(children = arguments[2])) {
				this.children = children;
			} else {
				this.handles = children;
			}
		} else {
			this.props = props;
			this.children = children;
			this.handles = handles;
		}		
	};
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
			if (child) {
				el.appendChild((child instanceof HTMLElement) ? child : document.createTextNode(child));
			}
		});
		return el;		
	}
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
		bind: function(element, type, handler) {
			var types = utils.isArray(type) ? type : type.trim().split(/\s+/),
				length = types.length;
			if (length) {
				while (length--) {
					element.addEventListener(types[length], handler, false);
				}
			}
			element = null;
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
        insertcode: '代码'
    };	

	// 初始化配置
	var EDITOR_CONFIG = {
		serverUrl: '',
		toolbars: ['code', '|', 'bold', 'italic', 'underline', 'strikethrough', 'forecolor', 'backcolor', 'removeformat', '|', 'quotes', 'fontname', 'fontsize', 'heading', 'indent', 'outdent', 
		'insertorderedlist', 'insertunorderedlist', 'justifyleft', 'justifycenter', 'justifyright', 'justifyfull', '|', 'createlink', 'insertimage', 'insertvideo', 'insertcode'],
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
        lang: Edit.langs['zh-ch']
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
					if (source[key] != null) prop[key] = source[key];
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
		closePopup: function(ev) {
			var current = ev && ev.target || document;
			var fixedlayer = document.getElementById('editor-fixedlayer');
	    	if (fixedlayer && current !== fixedlayer && !fixedlayer.contains(current)) {
	    		fixedlayer.parentNode.removeChild(fixedlayer);
				document.body.style.overflow = 'visible';
	    	}    
		},
		dialogOffset: function(editor) {
			var dialog = document.querySelector('.eui-dialog');
			if (Edit.ui.offset(dialog).left + dialog.offsetWidth > Edit.ui.offset(editor.container).left + editor.container.offsetWidth) {
				dialog.style.left = (Edit.ui.offset(editor.container).left + editor.container.offsetWidth - dialog.offsetWidth)+ 'px';
			}
		}
	};	

	UI.Stateful = {
		getDom: function() {
			return document.getElementById(this.id);
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
		this.cssRules = options.cssRules;
		this.handles = options.handles;
	}
	UI.Button.prototype = {
		getHtmlTpl: function() {
			var self = this;
			return UI.createEl('li',{id:self.id,class:'editor-item',style:self.cssRules,'data-title':self.title,draggable:true},[					
						UI.createEl('span',{class:'eicon '+self.className})	
					],self.handles);
		}
	}
	utils.extend(UI.Button.prototype, UI.Stateful);

	// 弹出式选项框
	UI.Menu = function(options) {
		this.id = 'uid' + uid++;
		this.content = options.content;
		this.handles = {
			mouseenter: function() {
				document.body.style.overflow = 'hidden';
			},
			mouseleave: function() {
				document.body.style.overflow = 'visible';
			}
		};
	}
	UI.Menu.prototype = {
		getHtmlTpl: function() {
			var self = this;
			return UI.createEl('div',{id:'editor-fixedlayer'},[self.content],self.handles);
		},
		show: function(fn) {
			document.body.appendChild(this.getHtmlTpl());
			fn && fn();
		}
	}
	/******************  Edit UI类 end  *****************/

	
	

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
            delete instances[id]
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
		var self = this;
		self.eid = eid++;
		self.commands = {};
		self.buttons = {};
		self.options = utils.extend(EDITOR_CONFIG, opt),
		Edit.plugin.load(self);
		Edit.instants['editorInstant' + self.eid] = this;
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

			container.appendChild(toolbar);
		},
		// 编辑器操作区域渲染
		render: function(container) {
			var self = this,
				options = this.options || {};
			if (utils.isString(container)) {
				container = document.getElementById(container);
			}
			if (!container) return;
			var edUI = self.container = Edit.ui.createEl('div',{id: 'edui'+self.eid, class: 'editor-container'});
			self.initToolbar(edUI);
			var html = [
				'<!DOCTYPE html>',
				'<html class=\'view\'>',
				'<head><meta charset=\'UTF-8\'><link rel=\'stylesheet\' href=\'\'>',
				'<style>',
					'html,body {margin:0; padding:0; word-wrap:break-word; cursor:text; height:100%;}',
					'body {padding: 8px; font-family: sans-serif; font-size: 14px;box-sizing:border-box;}',
					'p {margin: 5px 0}',
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
			edUI.appendChild(Edit.ui.createEl('span',{class:'eicon eicon-resize',style:'position:absolute;bottom:0;right:0;cursor:nwse-resize;font-size:12px;'},{'mousedown':function(e){
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

			self.initEvents();	
			self.focus();	
			self.isReady = 1;
			self.emit('ready');
		},
		// 获取 html内容
		getContent: function() {
			var self = this;
			return self.body.innerHTML;
		},
		// 获取文本内容
		getContentTxt: function() {
			var self = this;
			return self.body.textContent;
		},
		// 设置内容
		setContent: function(html, isAppendTo) {
			var self = this;
			self.body.innerHTML = (isAppendTo ? self.body.innerHTML : '') + html;
			self.domFilter();
			self.emit('contentchange');
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
			self.emit('contentchange');
			self.saveSelection();
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
		// div 替换
		replaceBlock: function() {
			var self = this;
			var child = self.body.firstChild, tmpNode;
			var p = self.document.createElement('p');
			while (child) {				
				if (child && child.nodeName === 'DIV') {	
					p.innerHTML = child.innerHTML;	
					child.parentNode.replaceChild(p, child);
					p = self.document.createElement('p');
				}
				child = child.nextSibling;
			}
		},
		// 初始化事件
		initEvents: function() {
			var self = this,
				doc = self.document,
				win = self.window;
			self.bind(doc, ['click', 'contextmenu', 'keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'selectstart'], self.proxyDomEvent.bind(self));
			self.bind(win, ['focus', 'blur'], self.proxyDomEvent.bind(self));
			self.bind(self.body, 'drop', function(e){
				self.emit('contentchange');
			});
			self.on('keyup',function(ev){
				if (ev.keyCode == 13) {
					self.saveSelection();
					self.replaceBlock();
					self.restoreSelection();
				} else if (ev.keyCode == 8) {
					if (!self.body.innerHTML) {
						self.body.innerHTML = '<p><br></p>';
					} 
				}
			});
			self.on('mouseup keyup', self.saveSelection.bind(self));
			self.bind(doc, ['mouseup', 'keydown'], function(ev){
				self.emit('selectionchange');
			});
			self.bind(doc,'mousedown',function(ev){
				Edit.ui.closePopup(ev);
			});
			utils.bind(document, 'mousedown scroll', function(ev){
		    	Edit.ui.closePopup(ev);
		    });				
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

		// 编辑器获取焦点	
		focus: function() {
			var self = this;
		    var range = self.document.createRange();
		    range.setStart(self.body.lastChild, 1);
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
			if (!child || child.nodeType == 1 && child === self.body.lastChild) {
				self.body.innerHTML = '<p><br></p>' + this.body.innerHTML;
			} else {
				var p = self.document.createElement('p');
				while (child) {
					while (child && child.nodeType == 3) {
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
		// 获取编辑区域光标位置
		getCurrentRange: function() {
			var self = this;
			return self.document.getSelection().getRangeAt(0);
		},
		// 保存编辑区域光标位置
		saveSelection: function() {
			var self = this;
			self.currentRange = self.getCurrentRange();
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
		}
	};
	utils.inherits(Editor,Events);
	/******************  Edit 编辑器实例 end  *****************/



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
	Edit.plugin = function() {
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
    	Edit.ui[cmd] = function(editor) {

    		editor.commands[cmd] = {
				execCommand: function() {
					this.document.execCommand(cmd,false,null);
				},
				queryCommandState: function() {
					return this.document.queryCommandState(cmd);
				}
			};

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

    		editor.addListener('selectionchange', function(type){
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
    	Edit.ui[cmd] = function(editor) {

    		editor.commands[cmd] = {
				execCommand: function(c,b,v) {
					this.document.execCommand(c,b,v);					
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

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
		    			var menu = new Edit.ui.Menu({
				    		content: Edit.ui.createEl('ul',{class:'menu-list menu-colors',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options.colors,function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key},[Edit.ui.createEl('span',{class:'eicon eicon-'+cmd,style:'color:'+val})],{click:function(ev){editor.execCommand(cmd,false,val);Edit.ui.closePopup();}})
				    		}))
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(type){
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
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,b,v) {
					this.document.execCommand('formatblock',b,v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState('formatblock');
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue('formatblock');
				}
			};

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Menu({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key},[Edit.ui.createEl(val,[key])],{click:function(ev){editor.execCommand(cmd,false,val);Edit.ui.closePopup();}})
				    		}))
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(type){
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
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,b,v) {
					this.document.execCommand(c,b,v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				var self = this;
		    			var menu = new Edit.ui.Menu({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:val},[Edit.ui.createEl('span',{style:'font-family:'+val+''},[val])],{click:function(ev){editor.execCommand(cmd,false,val);Edit.ui.closePopup();}})
				    		}))
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(type){
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
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,b,v) {
					this.document.execCommand(c,b,v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

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
		    			var menu = new Edit.ui.Menu({
				    		content: Edit.ui.createEl('ul',{class:'menu-list',style:Edit.ui.getPanelOffset(self.id)},Edit.utils.map(editor.options[cmd+'s'],function(val,key){
				    			return Edit.ui.createEl('li',{class:'menu-item',title:key,style:'font-size:'+key},[key],{click:function(ev){editor.execCommand(cmd,false,val);Edit.ui.closePopup();}})
				    		}))
				    	});
		    			menu.show();
	    			}
    			}
    		});    		

    		editor.addListener('selectionchange', function(type){
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
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,v) {
					this.execCommand('inserthtml',v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

    		var ui = new Edit.ui.Button({
    			name: cmd,
    			className: 'eicon-' + cmd,
    			title: editor.options.lang[cmd],
    			handles: {
    				click: function() {
    					if (ui.isDisabled()) return;
	    				editor.execCommand(cmd,'<h2>h2h2</h2>');
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

    // 命令：创建链接
    ['createlink'].forEach(function(cmd){
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,b,v) {
					this.document.execCommand(c,b,v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

			function insertLink() {
				var href = document.getElementById('input-link').value;
				if (href) {
					editor.execCommand(cmd,false,href);
					Edit.ui.closePopup();
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
		    			var menu = new Edit.ui.Menu({
				    		content: ce('div',{class:'eui-dialog',style:Edit.ui.getPanelOffset(self.id)},[
				    			ce('div',{class:'panel-box'},[					    			
					    			ce('div',{class:'panel-content'},[	
				    					ce('input',{id:'input-link',class:'input-text',type:'text',placeholder:'http://'}),
				    					ce('div',{class:'panel-handles'},[
				    						ce('span',{class:'panel-cancel'},['取消'],{click:function(){Edit.ui.closePopup()}}),
				    						ce('span',{class:'panel-confirm'},['确定'],{click:insertLink})					    					
					    				])
					    			])
					    		])
				    		])
				    	});
		    			menu.show();
		    			Edit.ui.dialogOffset(editor);
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
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,v) {
					this.execCommand('inserthtml',v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

			function sendAndInsertFile(ev) {
				var file = this.files[0];
				var rFilter = /^(image\/bmp|image\/gif|image\/jpeg|image\/png|image\/jpg)$/i;
    			var url = 'http://www.daily.bookln.cn/comm/file/upload.do';
    			var loadingId = 'loading_' + (+new Date()).toString(36);
    			var Form = new FormData();
    			Form.append('file', file);
    			editor.execCommand('inserthtml', '<img id="'+ loadingId +'" src="assets/images/loading.gif">');
    			if (rFilter.test(file.type)) {
    				Edit.Ajax(url,'post',Form,function(cb){
    					var loader = editor.document.getElementById(loadingId);
						loader.setAttribute('src',cb.data.url);
						loader.removeAttribute('id');
    					Edit.ui.closePopup();
    				})
    			}
			}

			function insertImg() {
				var src = document.getElementById('input-src').value;
				if (src) {
					editor.execCommand('inserthtml', '<img src="'+ src +'">');
					Edit.ui.closePopup();
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
		    			var menu = new Edit.ui.Menu({
				    		content: ce('div',{class:'eui-dialog',style:Edit.ui.getPanelOffset(self.id)},[
				    			ce('div',{class:'panel-box'},[
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
					    					ce('input',{id:'input-src',class:'input-text',type:'text',placeholder:'http://'}),
					    					ce('div',{class:'panel-handles'},[
					    						ce('span',{class:'panel-cancel'},['取消'],{click:function(){Edit.ui.closePopup()}}),
					    						ce('span',{class:'panel-confirm'},['确定'],{click:insertImg})
					    					])
					    				])
					    			])
					    		])
				    		])
				    	});
		    			menu.show(insertImgEvent);
		    			Edit.ui.dialogOffset(editor);
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

    // 命令：插入视频
    ['insertvideo'].forEach(function(cmd){
    	Edit.ui[cmd] = function(editor) {    		
    		editor.commands[cmd] = {
				execCommand: function(c,v) {
					this.execCommand('inserthtml',v);
				},
				queryCommandState: function(c,b,v) {
					return this.document.queryCommandState(c);
				},
				queryCommandValue: function(c,b,v) {
					return this.document.queryCommandValue(c);
				}
			};

			var video = [
							'<video width="320" height="240" controls autoplay>',
							  	'<source src="http://www.runoob.com/try/demo_source/movie.ogg" type="video/ogg">',
							  	'<source src="http://www.runoob.com/try/demo_source/movie.mp4" type="video/mp4">',
							  	'<source src="http://www.runoob.com/try/demo_source/movie.webm" type="video/webm">',
							  	'<object data="http://www.runoob.com/try/demo_source/movie.mp4" width="320" height="240">',
								    '<embed width="320" height="240" src="http://www.runoob.com/try/demo_source/movie.swf">',
								'</object>',
							'</video>'
						].join('')


			function insertLink() {
				var src = document.getElementById('input-link').value;
				if (src) {
					editor.execCommand(cmd,video);
					Edit.ui.closePopup();
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
		    			var menu = new Edit.ui.Menu({
				    		content: ce('div',{class:'eui-dialog',style:Edit.ui.getPanelOffset(self.id)},[
				    			ce('div',{class:'panel-box'},[					    			
					    			ce('div',{class:'panel-content'},[	
				    					ce('input',{id:'input-link',class:'input-text',type:'text',placeholder:'http://'}),
				    					ce('div',{class:'panel-handles'},[
				    						ce('span',{class:'panel-cancel'},['取消'],{click:function(){Edit.ui.closePopup()}}),
				    						ce('span',{class:'panel-confirm'},['确定'],{click:insertLink})					    					
					    				])
					    			])
					    		])
				    		])
				    	});
		    			menu.show();
		    			Edit.ui.dialogOffset(editor);
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

    // 拓展：粘贴图片
    Edit.plugin.register('autouplod', function(){
    	function getPasteImage(e){
	        return e.clipboardData && e.clipboardData.items && e.clipboardData.items.length == 1 && /^image\//.test(e.clipboardData.items[0].type) ? e.clipboardData.items:null;
	    }
	    function getDropImage(e){
	        return  e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files:null;
	    }

	    function sendAndInsertFile(file,editor) {
			var url = 'http://www.daily.bookln.cn/comm/img/base64/upload.do';
			var Form = new FormData();
			var loadingId = 'loading_' + (+new Date()).toString(36);
			Form.append('data', file);
			editor.execCommand('inserthtml', '<img id="'+ loadingId +'" src="assets/images/loading.gif">');
			
			Edit.Ajax(url,'post',Form,function(cb){
				var loader = editor.document.getElementById(loadingId);
				loader.setAttribute('src',cb.data.url);
				loader.removeAttribute('id');
				Edit.ui.closePopup();
			});
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
											// event.target.result 即为图片的Base64编码字符串
											var base64_str = event.target.result;
											sendAndInsertFile(base64_str,self);
											// self.execCommand('inserthtml','<img src="'+base64_str+'">')
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
})();

