var Thorax,
  mode = 0777 ^ process.umask(),
  path = require('path'),
  fs = require('fs'),
  exec = require('child_process').exec,
  handlebars = require('handlebars');

//private methods
var camelize = function(string) {
    return string.replace (/(?:^|[-_])(\w)/g, function (_, c) {
      return c ? c.toUpperCase () : '';
    });
  },

  cleanFileName = function(name, pattern, extension) {
    if (name.match(pattern)) {
      name = name.replace(pattern, '');
    }
    if (!name.match(/\.(js|coffee)$/)) {
      name = name + (extension ? '.' + extension : (this.thoraxJSON.language === 'javascript' ? '.js' : '.coffee'));
    }
    return name;
  },

  nameFromFileName = function(file_name) {
    return path.basename(file_name).replace(/\..*$/, '');
  },

  moduleNameFromArguments = function(args) {
    if (args.length === 1) {
      module_name = args[0].split('/').shift();
    } else {
      module_name = args[0];
    }
    if (!this.lumbarJSON.modules[module_name]) {
      this.error('module "' + module_name + '" does not exist');
      console.log('');
      console.log('To create a module or router with this name run either:');
      console.log('  thorax router ' + module_name);
      console.log('  thorax module ' + module_name);
      console.log('');
      if (args.length === 1) {
        console.log('Or specify an existing module:');
        console.log('  thorax ' + module.exports.currentAction + ' your-module-name ' + args[0]);
      }
      console.log('');
      return false;
    }
    return module_name;
  },

  fileNameFromArguments = function(args) {
    if (args.length === 1) {
      return args[0];
    } else {
      return args[1];
    }
  },

  // Recursive mkdir
  mkdirsSync = function(dirname) {
    var pathsNotFound = [];
    var fn = dirname;
    while (true) {
      try {
        var stats = fs.statSync(fn);
        if (stats.isDirectory()) {
          break;
        }
        throw new Error('Unable to create directory at ' + fn);
      }
      catch (e) {
        pathsNotFound.push(fn);
        fn = path.dirname(fn);
      }
    }
    for (var i = pathsNotFound.length - 1; i >- 1; i--) {
      var fn = pathsNotFound[i];
      fs.mkdirSync(fn, mode);
    }
    return pathsNotFound;
  },

  detectThoraxProjectDir = function(options) {
    if (!path.existsSync(path.join(this.target, 'package.json')) || !path.existsSync(path.join(this.target, 'lumbar.json')) || !path.existsSync(path.join(this.target, 'thorax.json'))) {
      //crude attempt to see if we are in a thorax project dir
      var dir, test_target;
      for (var i = 1; i < 4; ++i) {
        dir = [this.target];
        for (var _i = 0; _i < i; ++_i) {
          dir.push('..');
        }
        test_target = path.join.apply(path, dir);
        if (path.existsSync(path.join(test_target, 'package.json')) && path.existsSync(path.join(test_target, 'lumbar.json')) && path.existsSync(path.join(test_target, 'thorax.json'))) {
          setTarget.call(this, test_target);
          return true;
        }
      }
      thorax.log(this.target + ' does not appear to be a thorax project, lumbar.json, thorax.json, package.json must be present');
      if (!options || typeof options.exit === 'undefined' || options.exit === false) {
        process.exit(1);
        return false;
      }
    } else {
      return true;
    }
  },

  setTarget = function(target) {
    this.target = target;
    this._packageJSONPath = path.join(this.target, 'package.json');
    this._lumbarJSONPath = path.join(this.target, 'lumbar.json');
    this._thoraxJSONPath = path.join(this.target, 'thorax.json');
  };

//constructor
module.exports = function(target, options) {
  this.generatorName = 'base'; //for thorax.log
  this.loadPrefix = '';
  setTarget.call(this, target || process.cwd());
  if (options && options.create) {
    this.project = camelize(path.basename(this.target));
  } else {
    if (detectThoraxProjectDir.call(this, options)) {
      this.packageJSON = JSON.parse(fs.readFileSync(this._packageJSONPath));
      this.lumbarJSON = JSON.parse(fs.readFileSync(this._lumbarJSONPath));
      this.thoraxJSON = JSON.parse(fs.readFileSync(this._thoraxJSONPath));
      this.project = this.lumbarJSON.application.name;
    }
  }
};

module.exports.action = function (action) {
  module.exports.currentAction = action;
  return module.exports.actions[action].apply(this, Array.prototype.slice.call(arguments, 1));
};

module.exports.help = [
  "Usage:",
  "",
  "Create a new project & directory:",
  "",
  "  thorax create project-name",
  "",
  "In project directory:",
  "",
  "  thorax view module-name file-name",
  "  thorax collection-view module-name file-name",
  "  thorax model [module-name] file-name",
  "  thorax collection [module-name] file-name",
  "  thorax router module-name",
  "  thorax module name",
  "  thorax template template",
  "  thorax platform name",
  "  thorax package name"
].join("\n");

//actions
module.exports.actions = {
  create: function(target) {
    var commands = [
      'git clone git://github.com/walmartlabs/thorax-example.git ' + target,
      'cd ' + target,
      'rm -rf .git',
      'mkdir public',
      'npm install'
    ];
    console.log(commands.join("\n"));
    exec(commands.join(";"), function(error, stdout, stderr) {
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.log(stderr);
      }
      console.log('new lumbar + thorax project created in ' + target);
    });
  }
};

[
  'view',
  'collection-view',
  'collection',
  'model',
  'router',
  'style',
  'template',
  'package',
  'platform',
  'module'
].forEach(function(action) {
  module.exports.actions[action] = function() {
    var thorax = new module.exports();
    thorax[action].apply(thorax, arguments);
    if (thorax.thoraxJSON.modifyLumbarJSON) {
      thorax.save();
    } else {
      return thorax.helpMessages;
    }
  };
});

//instance methods
var methods = {
  save: function(next) {
    fs.writeFileSync(this._packageJSONPath, JSON.stringify(this.packageJSON, null, 2));
    fs.writeFileSync(this._lumbarJSONPath, JSON.stringify(this.lumbarJSON, null, 2));
    if (next) {
      next();
    }
  },

  help: function(messages) {
    if (!this.helpMessages) {
      this.helpMessages = [];
    }
    this.helpMessages.push('');
    this.helpMessages = this.helpMessages.concat(messages);
  },
  
  log: function(message) {
    console.log(message);
  },
  
  error: function(message) {
    console.log('error: ' + message);
  },

  warn: function(message) {
    console.log('warning: ' + message);
  },
  
  mkdir: function(name) {
    fs.mkdirSync((!name ? this.target : path.join(this.target, name)), mode);
  },
  
  copy: function(src, dest) {
    fs.writeFileSync(path.join(this.target, dest), fs.readFileSync(src));
  },

  symlink: function(src, dest) {
    fs.symlinkSync(src, path.join(this.target, dest));
  },

  checkPath: function(dir) {
    var target_path = path.join(this.target, path.dirname(dir));
    if (!path.existsSync(target_path)) {
      mkdirsSync.call(this, target_path).forEach(function(created_dir) {
        this.log('created directory: ' + created_dir.substring(this.target.length + 1, created_dir.length));
      }, this);
    }
  },
    
  writeFile: function(dest, contents) {
    if (path.existsSync(dest)) {
      this.warn(dest + ' already exists');
      return false;
    }
    fs.writeFileSync(path.join(this.target, dest), contents);
    return true;
  },

  render: function(src, context) {
    var template_src = fs.readFileSync(src).toString(),
      template = handlebars.compile(template_src);
    context = context || {};
    context.project = this.project;
    context.target = this.target;
    context.loadPrefix = this.loadPrefix;
    context.packageJSON = this.packageJSON;
    context.lumbarJSON = this.lumbarJSON;
    return template(context);
  },

  view: function(module_name, file_name) {
    file_name = fileNameFromArguments.call(this, arguments);
    module_name = moduleNameFromArguments.call(this, arguments);
    if (module_name) {
      file_name = cleanFileName.call(this, file_name, /^\/?app\/views\/?/);
      var full_path = path.join(this.thoraxJSON.paths.views, file_name),
        engine = 'handlebars',
        template_path = path.join(this.target, this.thoraxJSON.paths.generators, 'view.handlebars'),
        view_template_path = path.join(this.thoraxJSON.paths.templates, file_name).replace(/\.(js|coffee)$/, '.' + engine)
      
      this.checkPath(full_path);
      this.checkPath(view_template_path);

      if(this.writeFile(full_path, this.render(template_path, {
        fileName: full_path,
        moduleName: module_name,
        name: file_name.replace(/\.(js|coffee)$/, ''),
        className: camelize(file_name.replace(/\.(js|coffee)$/, '').replace(/\//g, '-'))
      }))) {
        this.log('created view: ' + full_path);
      }

      if (this.writeFile(view_template_path, '')) {
        this.log('created template: ' + view_template_path);
      }

      if (this.thoraxJSON.modifyLumbarJSON) {
        this.lumbarJSON.modules[module_name].files.push(full_path);
        this.lumbarJSON.templates[full_path] = [view_template_path];
      } else {
        this.help([
          'in modules.' + module_name + '.files:',
          '',
          '        "' + full_path + '"',
          '',
          'in templates:',
          '',
          '    "' + full_path + '": [',
          '      "' + view_template_path + '"',
          '    ]'
        ]);
      }
    }
  },

  'collection-view': function(module_name, file_name) {
    module_name = moduleNameFromArguments.call(this, arguments);
    file_name = fileNameFromArguments.call(this, arguments);
    if (module_name) {
      file_name = cleanFileName.call(this, file_name, /^\/?app\/views\/?/);

      var full_path = path.join(this.thoraxJSON.paths.views, file_name),
        engine = 'handlebars',
        template_path = path.join(this.target, this.thoraxJSON.paths.generators, 'collection-view.handlebars'),
        view_template_path = path.join(this.thoraxJSON.paths.templates, file_name).replace(/\.(js|coffee)$/, '.' + engine);
      
      this.checkPath(full_path);

      //view file
      if(this.writeFile(full_path, this.render(template_path, {
        fileName: full_path,
        moduleName: module_name,
        name: file_name.replace(/\.(js|coffee)$/, ''),
        className: camelize(file_name.replace(/\.(js|coffee)$/, '').replace(/\//g, '-'))
      }))) {
        this.log('created view: ' + file_name);
      }

      if (this.thoraxJSON.modifyLumbarJSON) {
        this.lumbarJSON.modules[module_name].files.push(full_path);
  
        //templates
        this.lumbarJSON.templates[full_path] = [
          view_template_path,
          view_template_path.replace(new RegExp('.' + engine + '$'), '-item.' + engine),
          view_template_path.replace(new RegExp('.' + engine + '$'), '-empty.' + engine)
        ];
        this.lumbarJSON.templates[full_path].forEach(function(_view_template_path) {
          this.checkPath(_view_template_path);
          if (this.writeFile(_view_template_path, '')) {
            this.log('created template: ' + _view_template_path);
          }
        }, this);
      } else {
        this.help([
          'in modules.' + module_name + '.files:',
          '',
          '        "' + full_path + '"',
          '',
          'in templates:',
          '    "' + full_path + '": [',
          '      "' + view_template_path + '"',
          '      "' + view_template_path.replace(new RegExp('.' + engine + '$'), '-item.' + engine) + '"',
          '      "' + view_template_path.replace(new RegExp('.' + engine + '$'), '-empty.' + engine) + '"',          
          '    ]'
        ]);
      }
    }
  },

  model: function(module_name, file_name) {
    file_name = fileNameFromArguments.call(this, arguments);
    module_name = moduleNameFromArguments.call(this, arguments);
    if (module_name) {
      file_name = cleanFileName.call(this, file_name, /^\/?app\/models\/?/);

      var full_path = path.join(this.thoraxJSON.paths.models, file_name),
        template_path = path.join(this.target, this.thoraxJSON.paths.generators, 'model.handlebars');
      
      this.checkPath(full_path);

      if(this.writeFile(full_path, this.render(template_path, {
        fileName: full_path,
        moduleName: module_name,
        name: file_name.replace(/\.(js|coffee)$/, ''),
        className: camelize(file_name.replace(/\.(js|coffee)$/, '').replace(/\//g, '-'))
      }))) {
        this.log('created model: ' + full_path);
      }

      if (this.thoraxJSON.modifyLumbarJSON) {
        this.lumbarJSON.modules[module_name].files.push(full_path);
      } else {
        this.help([
          'in modules.' + module_name + '.files:',
          '',
          '        "' + full_path + '"'
        ]);
      }
    }
  },

  collection: function(module_name, file_name) {
    file_name = fileNameFromArguments.call(this, arguments);
    module_name = moduleNameFromArguments.call(this, arguments);
    if (module_name) {
      file_name = cleanFileName.call(this, file_name, /^\/?app\/models\/?/);

      var full_path = path.join(this.thoraxJSON.paths.collections, file_name),
        template_path = path.join(this.target, this.thoraxJSON.paths.generators, 'collection.handlebars');

      this.checkPath(full_path);

      if (this.writeFile(full_path, this.render(template_path, {
        fileName: full_path,
        moduleName: module_name,
        name: file_name.replace(/\.(js|coffee)$/, ''),
        className: camelize(file_name.replace(/\.(js|coffee)$/, '').replace(/\//g, '-'))
      }))) {
        this.log('created collection: ' + full_path);
      }

      if (this.thoraxJSON.modifyLumbarJSON) {
        this.lumbarJSON.modules[module_name].files.push(full_path);
      } else {
        this.help([
          'in modules.' + module_name + '.files:',
          '',
          '        "' + full_path + '"'
        ]);
      }
    }
  },

  router: function(file_name) {
    file_name = cleanFileName.call(this, file_name, /^\/?app\/routers\/?/);
    file_name = path.join(this.thoraxJSON.paths.routers, file_name);
    
    this.checkPath(file_name);

    var template_path = path.join(this.target, this.thoraxJSON.paths.generators, 'router.handlebars'),
      name = nameFromFileName(file_name),
      template_output = this.render(template_path,{
        name: name,
        fileName: file_name,
        name: name,
        className: camelize(name)
      });

    if(this.writeFile(file_name, template_output)) {
      this.log('created router: ' + file_name);
    }

    if (!this.lumbarJSON.modules[name]) {
      this.module(name);
    }  
  },

  style: function(file_name) {
    file_name = cleanFileName.call(this, file_name, /^\/?app\/styles\/?/, 'styl');
    var full_path = path.join(this.thoraxJSON.paths.styles, file_name);
    this.checkPath(full_path);
    if (this.writeFile(full_path, '')) {
      this.log('created stylesheet: ' + file_name);
    }
    //TODO: modify JSON based on final spec
  },

  template: function(file_name) {
    file_name = cleanFileName.call(this, file_name, /^\/?app\/templates\/?/);
    var full_path = path.join(this.thoraxJSON.paths.templates, file_name);
    this.checkPath(full_path);
    if (this.writeFile(full_path, '')) {
      this.log('created template: ' + full_path);
    }    
  },

  platform: function(name) {
    var file_path = path.join('app', 'platform', name + (this.thoraxJSON.language === 'javascript' ? '.js' : '.coffee'));
    if (this.writeFile(file_path)) {
      this.log('created file: ' + file_path);
    }
    if (this.thoraxJSON.modifyLumbarJSON) {
      this.lumbarJSON.platforms.push(name);
      this.lumbarJSON.modules.base.files.push({
        src: file_path,
        global: true,
        platform: name
      });
      this.log('created platform: ' + name);
    } else {
      this.help([
        'in platforms:',
        '',
        '    "' + name + '"',
        '',
        'in modules.base.files:',
        '',
        '        {',
        '          "src": "' + file_path + '",',
        '          "global": true,',
        '          "platform": "' + name + '"',
        '        }'
      ]);
    }
    this.style(name);
  },

  'package': function(name) {
    if (this.thoraxJSON.modifyLumbarJSON) {
      this.lumbarJSON.packages[name] = {
        platforms: this.lumbarJSON.platforms,
        combine: false
      };
      this.log('created package: ' + name);
    } else {
      this.help([
        'in packages:',
        '',
        '    "' + name + '": {',
        '      "platforms": [' + this.lumbarJSON.platforms.map(function(platform){return '"' + platform + '"';}).join(', ') + '],',
        '      "combine": false',
        '    }'
      ]);
    }
  },

  'module': function(name) {
    if (this.thoraxJSON.modifyLumbarJSON) {
      this.lumbarJSON.modules[name] = {
        routes: {},
        files: []
      };
      this.log('created module: ' + name);
    } else {
      this.help([
        'in modules:',
        '',
        '    "' + name + '": {',
        '      "routes": {},',
        '      "files": []', 
        '    }'
      ]);
    }
  }
};

for (var name in methods) {
  module.exports.prototype[name] = methods[name];
}
