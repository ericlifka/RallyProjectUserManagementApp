var fs = require('fs');

function collect(obj, func) {
    var collection = [];
    if (obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                collection.push(func(obj[key], key, obj));
            }
        }
    }
    return collection;
}

function isArray(obj) {
    return typeof obj === "object" && obj.length > 0;
}

function doWithDefault(func, defaultValue) {
    try {
        return func();
    }
    catch (ignored) {
        return defaultValue;
    }
}

var $ = function (tag, attributes) {
    var tab = "    ";

    function indentString(level) {
        if (level <= 0) {
            return "";
        }
        return tab + indentString(level - 1);
    }

    function buildAttributesString(attributes) {
        return collect(attributes,function (value, key) {
            return ' ' + key + '="' + value + '"';
        }).join('');
    }

    function indentElementValue(indentLevel, elValue) {
        if (!elValue) {
            return "";
        }
        return collect(elValue.split('\n'),function (line) {
            return indentString(indentLevel) + line;
        }).join('\n') + '\n';
    }

    return {
        tag: tag,
        children: [],
        attributes: attributes,
        value: null,
        append: function () {
            for (var i = 0; i < arguments.length; i++) {
                if (isArray(arguments[i])) {
                    this.append.apply(this, arguments[i])
                } else {
                    this.children.push(arguments[i]);
                }
            }
            return this;
        },
        text: function (text) {
            this.value = text;
            return this;
        },
        asString: function (indentLevel) {
            indentLevel = indentLevel || 0;

            var openingTag = indentString(indentLevel) + "<" + tag + buildAttributesString(this.attributes) + ">";
            var closingTag = "</" + tag + ">\n";
            if (this.value || this.children.length) {
                openingTag += "\n";
                closingTag = indentString(indentLevel) + closingTag;
            }

            var children = collect(this.children,function (child) {
                return child.asString(indentLevel + 1);
            }).join('');

            var value = indentElementValue(indentLevel + 1, this.value);

            return openingTag + children + value + closingTag;
        }
    }
};

["build", "debug"].forEach(function (directory) {
    doWithDefault(function () { fs.mkdirSync(directory); });
});

var buildConfig = doWithDefault(function () {
    return JSON.parse(fs.readFileSync('buildConfig.json'));
}, {});

var sourceFiles = doWithDefault(function () {
    return fs.readdirSync('src');
}, []);

function buildPage(scriptFunc) {
    return $('html').append(
        $('head').append(
            $('title').text(buildConfig.appTitle)
        ),
        $('body').append(
            collect(buildConfig.dependencies, function (url) {
                return $('script', {type: "text/javascript", src: url});
            }),
            scriptFunc()
        )
    )
}

var debugHtml = buildPage(function () {
    return collect(sourceFiles, function (file) {
        return $('script', {
            type: "text/javascript",
            src: "../src/" + file
        });
    })
});

var appHtml = buildPage(function () {
    return $('script', {type: "text/javascript"}).text(collect(sourceFiles,function (file) {
        return fs.readFileSync('src/' + file, 'utf8');
    }).join('\n'));
});

fs.writeFileSync("debug/debug.html", debugHtml.asString());
fs.writeFileSync("build/app.html", appHtml.asString());
