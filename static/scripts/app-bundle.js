define('app',['exports', 'aurelia-framework', 'services', 'resources/dialogs'], function (exports, _aureliaFramework, _services, _dialogs) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.App = undefined;

  function _asyncToGenerator(fn) {
    return function () {
      var gen = fn.apply(this, arguments);
      return new Promise(function (resolve, reject) {
        function step(key, arg) {
          try {
            var info = gen[key](arg);
            var value = info.value;
          } catch (error) {
            reject(error);
            return;
          }

          if (info.done) {
            resolve(value);
          } else {
            return Promise.resolve(value).then(function (value) {
              return step("next", value);
            }, function (err) {
              return step("throw", err);
            });
          }
        }

        return step("next");
      });
    };
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _dec, _class;

  var client = new _services.ApiClient();

  var App = exports.App = (_dec = (0, _aureliaFramework.inject)(_dialogs.Dialogs), _dec(_class = function () {
    function App(dialogs) {
      _classCallCheck(this, App);

      this.todos = [];
      this.active_todo = null;
      this.loading = false;

      this.dialogs = dialogs;
      this.message = 'Hello Django REST Framework!';
    }

    App.prototype.resetNewTodo = function resetNewTodo() {
      this.new_todo = {};
    };

    App.prototype.activate = function () {
      var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                window.page = this;
                this.resetNewTodo();
                this.readTodos();

              case 3:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function activate() {
        return _ref.apply(this, arguments);
      }

      return activate;
    }();

    App.prototype.readTodos = function () {
      var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this.loading = true;
                _context2.prev = 1;
                _context2.next = 4;
                return client.get('todos/');

              case 4:
                this.todos = _context2.sent;
                _context2.next = 10;
                break;

              case 7:
                _context2.prev = 7;
                _context2.t0 = _context2['catch'](1);

                console.log(_context2.t0);

              case 10:
                this.loading = false;

              case 11:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[1, 7]]);
      }));

      function readTodos() {
        return _ref2.apply(this, arguments);
      }

      return readTodos;
    }();

    App.prototype.createTodo = function () {
      var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.prev = 0;
                _context3.next = 3;
                return client.post('todos/', this.new_todo);

              case 3:
                _context3.next = 8;
                break;

              case 5:
                _context3.prev = 5;
                _context3.t0 = _context3['catch'](0);

                console.log(_context3.t0);

              case 8:
                this.resetNewTodo();
                _context3.next = 11;
                return this.readTodos();

              case 11:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this, [[0, 5]]);
      }));

      function createTodo() {
        return _ref3.apply(this, arguments);
      }

      return createTodo;
    }();

    App.prototype.deleteTodo = function () {
      var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(todo) {
        var result;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return this.dialogs.confirm("削除", todo.text + " を削除します。よろしいですか？");

              case 2:
                result = _context4.sent;

                if (!result.wasCancelled) {
                  _context4.next = 5;
                  break;
                }

                return _context4.abrupt('return');

              case 5:
                _context4.prev = 5;
                _context4.next = 8;
                return client.delete('todos/' + todo.id + '/');

              case 8:
                _context4.next = 13;
                break;

              case 10:
                _context4.prev = 10;
                _context4.t0 = _context4['catch'](5);

                console.log(_context4.t0);

              case 13:
                _context4.next = 15;
                return this.readTodos();

              case 15:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this, [[5, 10]]);
      }));

      function deleteTodo(_x) {
        return _ref4.apply(this, arguments);
      }

      return deleteTodo;
    }();

    App.prototype.openTodo = function openTodo(todo) {
      if (this.active_todo == todo) {
        this.active_todo = null;
      } else {
        this.active_todo = todo;
      }
    };

    return App;
  }()) || _class);
});
define('environment',["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {
    debug: true,
    testing: true
  };
});
define('main',['exports', './environment', 'babel-polyfill'], function (exports, _environment) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.configure = undefined;

  var _environment2 = _interopRequireDefault(_environment);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _asyncToGenerator(fn) {
    return function () {
      var gen = fn.apply(this, arguments);
      return new Promise(function (resolve, reject) {
        function step(key, arg) {
          try {
            var info = gen[key](arg);
            var value = info.value;
          } catch (error) {
            reject(error);
            return;
          }

          if (info.done) {
            resolve(value);
          } else {
            return Promise.resolve(value).then(function (value) {
              return step("next", value);
            }, function (err) {
              return step("throw", err);
            });
          }
        }

        return step("next");
      });
    };
  }

  var configure = exports.configure = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(aurelia) {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              aurelia.use.standardConfiguration().feature('resources').plugin('aurelia-dialog', function (settings) {
                settings.startingZIndex = 1111;
              });

              if (_environment2.default.debug) {
                aurelia.use.developmentLogging();
              }

              if (_environment2.default.testing) {
                aurelia.use.plugin('aurelia-testing');
              }

              _context.next = 5;
              return aurelia.start();

            case 5:
              aurelia.setRoot();

            case 6:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function configure(_x) {
      return _ref.apply(this, arguments);
    };
  }();
});
define('services',['exports', 'aurelia-fetch-client'], function (exports, _aureliaFetchClient) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ApiClient = undefined;

  function _asyncToGenerator(fn) {
    return function () {
      var gen = fn.apply(this, arguments);
      return new Promise(function (resolve, reject) {
        function step(key, arg) {
          try {
            var info = gen[key](arg);
            var value = info.value;
          } catch (error) {
            reject(error);
            return;
          }

          if (info.done) {
            resolve(value);
          } else {
            return Promise.resolve(value).then(function (value) {
              return step("next", value);
            }, function (err) {
              return step("throw", err);
            });
          }
        }

        return step("next");
      });
    };
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var client = new _aureliaFetchClient.HttpClient();
  client.configure(function (config) {
    config.withBaseUrl('/api/');
  });

  var ApiClient = exports.ApiClient = function () {
    function ApiClient() {
      _classCallCheck(this, ApiClient);
    }

    ApiClient.prototype.get = function () {
      var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(url) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return client.fetch(url);

              case 2:
                _context.next = 4;
                return _context.sent.json();

              case 4:
                return _context.abrupt('return', _context.sent);

              case 5:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function get(_x) {
        return _ref.apply(this, arguments);
      }

      return get;
    }();

    ApiClient.prototype.post = function () {
      var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(url, content) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return client.fetch(url, {
                  method: 'post',
                  body: (0, _aureliaFetchClient.json)(content)
                });

              case 2:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function post(_x2, _x3) {
        return _ref2.apply(this, arguments);
      }

      return post;
    }();

    ApiClient.prototype.put = function () {
      var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(url, content) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return client.fetch(url, {
                  method: 'put',
                  body: (0, _aureliaFetchClient.json)(content)
                });

              case 2:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function put(_x4, _x5) {
        return _ref3.apply(this, arguments);
      }

      return put;
    }();

    ApiClient.prototype.save = function () {
      var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(url, content) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (content.id >= 1) {
                  this.put(url, content);
                } else {
                  this.post(url, content);
                }

              case 1:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function save(_x6, _x7) {
        return _ref4.apply(this, arguments);
      }

      return save;
    }();

    ApiClient.prototype.delete = function () {
      var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5(url) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return client.fetch(url, {
                  method: 'delete'
                });

              case 2:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function _delete(_x8) {
        return _ref5.apply(this, arguments);
      }

      return _delete;
    }();

    return ApiClient;
  }();
});
define('resources/index',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.configure = configure;
  function configure(config) {
    config.globalResources('./value-converters/then');
  }
});
define('resources/value-converters/then',["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var ThenValueConverter = exports.ThenValueConverter = function () {
    function ThenValueConverter() {
      _classCallCheck(this, ThenValueConverter);
    }

    ThenValueConverter.prototype.toView = function toView(value, thenValue) {
      var elseValue = arguments.length <= 2 || arguments[2] === undefined ? "" : arguments[2];

      return value ? thenValue : elseValue;
    };

    return ThenValueConverter;
  }();
});
define('resources/dialogs',['exports', './dialogs/confirm', './dialogs/prompt', './dialogs/reply', './dialogs/blocker', './dialogs/upload', 'aurelia-dialog'], function (exports, _confirm, _prompt, _reply, _blocker, _upload, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.UploadModel = exports.ReplyModel = exports.Dialogs = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _class, _temp;

	var Dialogs = exports.Dialogs = (_temp = _class = function () {
		function Dialogs(dialogService) {
			_classCallCheck(this, Dialogs);

			this.dialogService = dialogService;
		}

		Dialogs.prototype.open = function open(viewModel, model) {
			return this.dialogService.open({ viewModel: viewModel, model: model });
		};

		Dialogs.prototype.confirm = function confirm(question, message) {
			return this.dialogService.open({ viewModel: _confirm.Confirm, model: { question: question, message: message } });
		};

		Dialogs.prototype.prompt = function prompt(question) {
			return this.dialogService.open({ viewModel: _prompt.Prompt, model: question });
		};

		Dialogs.prototype.reply = function reply(model) {
			return this.dialogService.open({ viewModel: _reply.Reply, model: model });
		};

		Dialogs.prototype.block = function block() {
			var _this = this;

			var message = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

			var block = { message: message, blocking: true };
			setTimeout(function () {
				_this.dialogService.open({ viewModel: _blocker.Blocker, model: block });
			}, 50);
			return function () {
				if (block.closing) return;
				block.closing = true;
				var timer = setInterval(function () {
					if (block.controller) {
						block.controller.close();
						clearInterval(timer);
					}
				}, 400);
			};
		};

		Dialogs.prototype.upload = function upload(model) {
			return this.dialogService.open({ viewModel: _upload.Upload, model: model });
		};

		return Dialogs;
	}(), _class.inject = [_aureliaDialog.DialogService], _temp);

	var ReplyModel = exports.ReplyModel = function ReplyModel() {
		_classCallCheck(this, ReplyModel);

		this.title = '返信';
		this.description = '';
		this.content = null;
		this.bodyLabel = null;
		this.body = '';
		this.actionLabel = null;
		this.action = null;
	};

	var UploadModel = exports.UploadModel = function UploadModel() {
		_classCallCheck(this, UploadModel);

		this.title = 'アップロード';
		this.description = '';
		this.name = 'file';
		this.actionLabel = 'アップロード';
		this.cancelLabel = 'キャンセル';
		this.action = null;
	};
});
define('resources/dialogs/blocker',['exports', 'aurelia-framework', 'aurelia-dialog'], function (exports, _aureliaFramework, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Blocker = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var Blocker = exports.Blocker = (_dec = (0, _aureliaFramework.inject)(_aureliaDialog.DialogController), _dec(_class = function () {
		function Blocker(controller) {
			_classCallCheck(this, Blocker);

			this.controller = controller;
		}

		Blocker.prototype.activate = function activate(block) {
			this.block = block;
			block.controller = this.controller;
		};

		return Blocker;
	}()) || _class);
});
define('resources/dialogs/prompt',['exports', 'aurelia-dialog'], function (exports, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Prompt = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _class, _temp;

	var Prompt = exports.Prompt = (_temp = _class = function () {
		function Prompt(controller) {
			_classCallCheck(this, Prompt);

			this.controller = controller;
			this.answer = null;

			controller.settings.lock = false;
		}

		Prompt.prototype.activate = function activate(question) {
			this.question = question;
		};

		return Prompt;
	}(), _class.inject = [_aureliaDialog.DialogController], _temp);
});
define('resources/dialogs/reply',['exports', 'aurelia-framework', 'aurelia-dialog'], function (exports, _aureliaFramework, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Reply = undefined;

	function _asyncToGenerator(fn) {
		return function () {
			var gen = fn.apply(this, arguments);
			return new Promise(function (resolve, reject) {
				function step(key, arg) {
					try {
						var info = gen[key](arg);
						var value = info.value;
					} catch (error) {
						reject(error);
						return;
					}

					if (info.done) {
						resolve(value);
					} else {
						return Promise.resolve(value).then(function (value) {
							return step("next", value);
						}, function (err) {
							return step("throw", err);
						});
					}
				}

				return step("next");
			});
		};
	}

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var Reply = exports.Reply = (_dec = (0, _aureliaFramework.inject)(_aureliaDialog.DialogController), _dec(_class = function () {
		function Reply(controller) {
			_classCallCheck(this, Reply);

			this.executing = false;

			this.controller = controller;
		}

		Reply.prototype.activate = function activate(model) {
			this.model = model;
			this.action = model.action;
		};

		Reply.prototype.execute = function () {
			var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
				var result;
				return regeneratorRuntime.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								if (!this.action) {
									_context.next = 9;
									break;
								}

								this.executing = true;
								_context.next = 4;
								return this.action(this.model);

							case 4:
								result = _context.sent;

								this.executing = false;
								if (result !== false) this.controller.ok(result);
								_context.next = 10;
								break;

							case 9:
								this.controller.ok(this.model);

							case 10:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this);
			}));

			function execute() {
				return _ref.apply(this, arguments);
			}

			return execute;
		}();

		return Reply;
	}()) || _class);
});
define('resources/dialogs/upload',['exports', 'aurelia-framework', 'aurelia-dialog'], function (exports, _aureliaFramework, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Upload = undefined;

	function _asyncToGenerator(fn) {
		return function () {
			var gen = fn.apply(this, arguments);
			return new Promise(function (resolve, reject) {
				function step(key, arg) {
					try {
						var info = gen[key](arg);
						var value = info.value;
					} catch (error) {
						reject(error);
						return;
					}

					if (info.done) {
						resolve(value);
					} else {
						return Promise.resolve(value).then(function (value) {
							return step("next", value);
						}, function (err) {
							return step("throw", err);
						});
					}
				}

				return step("next");
			});
		};
	}

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _dec, _class;

	var Upload = exports.Upload = (_dec = (0, _aureliaFramework.inject)(_aureliaDialog.DialogController), _dec(_class = function () {
		function Upload(controller) {
			_classCallCheck(this, Upload);

			this.uploading = false;

			this.controller = controller;
		}

		Upload.prototype.activate = function activate(model) {
			this.model = model;
			this.action = model.action;
		};

		Upload.prototype.upload = function () {
			var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
				var result;
				return regeneratorRuntime.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								this.model.notSelected = !this.model.file.value;

								if (this.model.notSelected) {
									_context.next = 8;
									break;
								}

								this.uploading = true;
								_context.next = 5;
								return this.action(this.model);

							case 5:
								result = _context.sent;

								this.uploading = false;
								if (result !== false) {
									this.controller.ok(result);
								}

							case 8:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this);
			}));

			function upload() {
				return _ref.apply(this, arguments);
			}

			return upload;
		}();

		return Upload;
	}()) || _class);
});
define('resources/dialogs/confirm',['exports', 'aurelia-dialog'], function (exports, _aureliaDialog) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports.Confirm = undefined;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var _class, _temp;

	var Confirm = exports.Confirm = (_temp = _class = function () {
		function Confirm(controller) {
			_classCallCheck(this, Confirm);

			this.controller = controller;

			controller.settings.lock = false;
		}

		Confirm.prototype.activate = function activate(model) {
			this.model = model;
		};

		return Confirm;
	}(), _class.inject = [_aureliaDialog.DialogController], _temp);
});
define('text!app.html', ['module'], function(module) { module.exports = "<template>\n  <require from=\"./app.css\"></require>\n\n  <div class=\"ui container\">\n    <h1>${message}</h1>\n\n    <div class=\"ui piled ${loading ? 'loading' : ''} segment\">\n      <div class=\"ui relaxed divided list\">\n        <div class=\"item\" repeat.for=\"todo of todos\">\n          <div class=\"right floated content\">\n            <i class=\"circular trash outline link icon\"\n               click.trigger=\"$parent.deleteTodo(todo)\"></i>\n          </div>\n          <div class=\"middle aligned content\">\n            <a class=\"header\">${todo.text}</a>\n            <div class=\"description\">2016/08/24 15:20</div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <form submit.trigger=\"createTodo()\">\n      <div class=\"ui fluid icon input\">\n        <input type=\"text\" placeholder=\"What I have to do...\" value.bind=\"new_todo.text\">\n        <i class=\"circular plus link icon\"\n           click.trigger=\"createTodo()\"></i>\n      </div>\n    </form>\n\n  </div>\n</template>\n"; });
define('text!resources/dialogs/blocker.html', ['module'], function(module) { module.exports = "<template>\n\t<ai-dialog>\n\n\t\t<ai-dialog-body>\n\t\t\t<div style=\"text-align: center;\">\n\t\t\t\t<i class=\"fa fa-circle-o-notch fa-spin fa-2x\"></i><br>\n\t\t\t\t${ block.message }\n\t\t\t</div>\n\t\t</ai-dialog-body>\n\n\t</ai-dialog>\n</template>"; });
define('text!resources/dialogs/prompt.html', ['module'], function(module) { module.exports = "<template>\n\t<ai-dialog>\n\t\t<ai-dialog-header>${question}</ai-dialog-header>\n\n\t\t<ai-dialog-body>\n\t\t\t<form submit.trigger=\"controller.ok(answer)\">\n\t\t\t\t<input type=\"text\" value.bind=\"answer\" style=\"width: 100%; line-height: 16px; font-size: 16px\" attach-focus>\n\t\t\t</form>\n\t\t</ai-dialog-body>\n\n\t\t<ai-dialog-footer>\n\t\t\t<button click.trigger=\"controller.cancel()\">Cancel</button>\n\t\t\t<button click.trigger=\"controller.ok(answer)\">OK</button>\n\t\t</ai-dialog-footer>\n\t</ai-dialog>\n</template>\n"; });
define('text!resources/dialogs/reply.html', ['module'], function(module) { module.exports = "<template>\n\t<require from=\"elements/form/form-group\"></require>\n\t<ai-dialog>\n\t\t<ai-dialog-header>${ model.title }</ai-dialog-header>\n\n\t\t<ai-dialog-body>\n\t\t\t<p>${ model.description }</p>\n\t\t\t<div class=\"well content\" innerhtml.bind=\"model.content\"></div>\n\t\t\t<form-group label=\"${ model.bodyLabel || '返信' }\">\n\t\t\t\t<textarea rows=\"10\" value.bind=\"model.body\"></textarea>\n\t\t\t</form-group>\n\t\t</ai-dialog-body>\n\n\t\t<ai-dialog-footer>\n\t\t\t<button class=\"btn btn-default\" disabled.bind=\"executing\" click.delegate=\"execute()\">\n\t\t\t\t<i class=\"fa fa-spin fa-spinner\" show.bind=\"executing\"></i> ${ model.actionLabel || 'OK' }\n\t\t\t</button>\n\t\t\t<button class=\"btn btn-default\" click.trigger=\"controller.cancel()\">キャンセル</button>\n\t\t</ai-dialog-footer>\n\t</ai-dialog>\n</template>\n"; });
define('text!resources/dialogs/upload.html', ['module'], function(module) { module.exports = "<template>\n\t<ai-dialog>\n\t\t\n\t\t<ai-dialog-header>${ model.title }</ai-dialog-header>\n\t\t\n\t\t<ai-dialog-body>\n\t\t\t<p>${ model.description }</p>\n\t\t\t<form submit.delegate=\"upload()\">\n\t\t\t\t<div class=\"form-group\" with.bind=\"model\">\n\t\t\t\t\t<label class=\"${ notSelected ? 'text-danger' : '' }\">\n\t\t\t\t\t\t${ label || 'ファイルを選択してください' }\n\t\t\t\t\t</label>\n\t\t\t\t\t<input type=\"file\" name=\"${ name || 'file' }\" ref=\"file\">\n\t\t\t\t</div>\n\t\t\t</form>\n\t\t</ai-dialog-body>\n\n\t\t<ai-dialog-footer>\n\t\t\t<button click.trigger=\"upload()\">\n\t\t\t\t<i class=\"fa fa-spin fa-spinner\" show.bind=\"uploading\"></i> ${ model.actionLabel || 'アップロード' }\n\t\t\t</button>\n\t\t\t<button click.trigger=\"controller.cancel()\">${ model.cancelLabel || 'キャンセル' }</button>\n\t\t</ai-dialog-footer>\n\t\t\n\t</ai-dialog>\n</template>"; });
define('text!resources/dialogs/confirm.html', ['module'], function(module) { module.exports = "<template>\n\t<ai-dialog>\n\t\t<ai-dialog-header>${model.question}</ai-dialog-header>\n\n\t\t<ai-dialog-body>\n      <p>${model.message}</p>\n\t\t</ai-dialog-body>\n\n\t\t<ai-dialog-footer>\n\t\t\t<button click.trigger=\"controller.cancel()\">Cancel</button>\n\t\t\t<button click.trigger=\"controller.ok(true)\">OK</button>\n\t\t</ai-dialog-footer>\n\t</ai-dialog>\n</template>\n"; });
define('text!style.css', ['module'], function(module) { module.exports = "ai-dialog-overlay {\n  background-color: rgba(255, 255, 255, 0.5);\n}\n"; });
define('text!app.css', ['module'], function(module) { module.exports = "ai-dialog-overlay {\n  background-color: rgba(255, 255, 255, 0.5);\n}\n"; });
//# sourceMappingURL=app-bundle.js.map