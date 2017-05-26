define("ace/mode/aiscript_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var AIScriptHighlightRules = function() {

    this.$rules = {
        start: [{
            include: "#comments"
        }, {
            include: "#triggers"
        }, {
            include: "#replies"
        }, {
            include: "#topics"
        }],
        "#alternates": [{
            token: [
                "keyword.control",
                "string.unquoted",
                "keyword.control"
            ],
            regex: /(\s\()([a-zA-Z0-9\s\-]*)(\|)/,
            push: [{
                token: "keyword.control",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#characters"
            }, {
                defaultToken: "meta.alternates"
            }]
        }],
        "#characters": [{
            token: "keyword.control",
            regex: /\,|\;|\|/
        }],
        "#comments": [{
            token: "comment.line.double-slash",
            regex: /\/\/.*$/
        }, {
            token: "comment.block",
            regex: /\/\*/,
            push: [{
                token: "comment.block",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment.block"
            }]
        }],
        "#constants": [{
            token: "constant.numeric",
            regex: /\d+/
        }, {
            token: "constant.character",
            regex: /[a-zA-Z0-9_]*/
        }, {
            token: "string.quoted.single",
            regex: /\'.*\'/
        }],
        "#filters": [{
            token: ["storage.type.function", "keyword.control"],
            regex: /(\{\^[a-zA-Z]*)(\()/,
            push: [{
                token: ["keyword.control", "storage.type.function"],
                regex: /(\))(\})/,
                next: "pop"
            }, {
                include: "#variables"
            }, {
                include: "#constants"
            }, {
                defaultToken: "meta.function"
            }]
        }],
        "#functions": [{
            token: ["storage.type.function", "keyword.control"],
            regex: /(\^[a-zA-Z]*)(\()/,
            push: [{
                token: "keyword.control",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#variables"
            }, {
                include: "#constants"
            }, {
                include: "#characters"
            }, {
                defaultToken: "meta.function"
            }]
        }],
        "#optionals": [{
            token: [
                "keyword.control",
                "string.unquoted",
                "keyword.control"
            ],
            regex: /(\s\[)([a-zA-Z0-9\s\-]*)(\])/
        }],
        "#references": [{
            token: "variable.parameter",
            regex: /^\s*\%\s/,
            push: [{
                token: "variable.parameter",
                regex: /$/,
                next: "pop"
            }, {
                include: "#comments"
            }, {
                defaultToken: "variable.parameter"
            }]
        }],
        "#replies": [{
            token: ["keyword.other", "comment.line.number-sign"],
            regex: /^(\s*\-\s)|(\s*\^\s)/,
            push: [{
                token: "meta.reply",
                regex: /$/,
                next: "pop"
            }, {
                include: "#variables"
            }, {
                include: "#comments"
            }, {
                include: "#functions"
            }, {
                include: "#topic-functions"
            }, {
                include: "#alternates"
            }, {
                include: "#filters"
            }, {
                include: "#reply-functions"
            }, {
                defaultToken: "meta.reply"
            }]
        }],
        "#reply-functions": [{
            token: "string.unquoted",
            regex: /^\s*\@\s[a-zA-Z0-9\-_]*/
        }],
        "#reply-redirect": [{
            token: "string.unquoted",
            regex: /\{\@[a-zA-Z0-9\-_]*\}/
        }],
        "#topic-functions": [{
            token: "storage.type.function",
            regex: /\{@/,
            push: [{
                token: "storage.type.function",
                regex: /\}/,
                next: "pop"
            }, {
                defaultToken: "storage.type.function"
            }]
        }, {
            token: "storage.type.function",
            regex: /\{keep\}/
        }],
        "#topic-redirect": [{
            token: "storage.type.function",
            regex: /\{topic=/,
            push: [{
                token: "storage.type.function",
                regex: /\}/,
                next: "pop"
            }, {
                defaultToken: "storage.type.function"
            }]
        }],
        "#topics": [{
            token: [
                "storage.type.class",
                "keyword.control",
                "keyword.control",
                "variable.parameter",
                "variable.parameter",
                "invalid.illegal",
                "keyword.control",
                "constant.character",
                "keyword.control"
            ],
            regex: /(^\s*\>\stopic|^\s*\>\spre|^\s*\>\spost)((?:\:nostay|\:keep|\:system)*)((?:\:nostay|\:keep|\:system)*)(\s[a-zA-Z0-9\-_]*)(\s*)([a-zA-Z0-9\-\s_]*)(\(*)([a-zA-Z\-\s_]*)(\)*)/,
            push: [{
                token: "storage.type.class",
                regex: /^\s*\<\stopic|^\s*\<\spre|^\s*\<\spost/,
                next: "pop"
            }, {
                include: "#references"
            }, {
                include: "#comments"
            }, {
                include: "#triggers"
            }, {
                include: "#replies"
            }, {
                include: "#reply-functions"
            }, {
                include: "#topic-redirect"
            }, {
                include: "#reply-redirect"
            }, {
                defaultToken: "meta.topic"
            }]
        }],
        "#triggers": [{
            token: "keyword.other",
            regex: /^(?:\s*\+\s|\s*\?\:*[a-zA-Z\:]*|\s*\?\s|\s*\#\s)/,
            push: [{
                token: "meta.trigger",
                regex: /$/,
                next: "pop"
            }, {
                include: "#comments"
            }, {
                include: "#functions"
            }, {
                include: "#alternates"
            }, {
                include: "#wildcards"
            }, {
                include: "#optionals"
            }, {
                include: "#filters"
            }, {
                defaultToken: "meta.trigger"
            }]
        }],
        "#variables": [{
            token: "variable.parameter",
            regex: /\<[a-zA-Z0-9_]*\>/
        }],
        "#wildcards": [{
            token: "variable.parameter",
            regex: /\*~*\d*/
        }, {
            token: ["variable.parameter", "string.unquoted"],
            regex: /(\~)([a-zA-Z0-9\-]*)/
        }]
    }
    
    this.normalizeRules();
};

AIScriptHighlightRules.metaData = {
    fileTypes: ["ss", "ais", "rive"],
    name: "AIScript",
    scopeName: "text.aiscript"
}


oop.inherits(AIScriptHighlightRules, TextHighlightRules);

exports.AIScriptHighlightRules = AIScriptHighlightRules;
});

define("ace/mode/folding/cstyle",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var Range = require("../../range").Range;
var BaseFoldMode = require("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(commentRegex) {
    if (commentRegex) {
        this.foldingStartMarker = new RegExp(
            this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
        );
        this.foldingStopMarker = new RegExp(
            this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
        );
    }
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
    
    this.foldingStartMarker = /(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{]*(\}|\])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
    this._getFoldWidgetBase = this.getFoldWidget;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
    
        if (this.singleLineBlockCommentRe.test(line)) {
            if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                return "";
        }
    
        var fw = this._getFoldWidgetBase(session, foldStyle, row);
    
        if (!fw && this.startRegionRe.test(line))
            return "start"; // lineCommentRegionStart
    
        return fw;
    };

    this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var line = session.getLine(row);
        
        if (this.startRegionRe.test(line))
            return this.getCommentRegionBlock(session, line, row);
        
        var match = line.match(this.foldingStartMarker);
        if (match) {
            var i = match.index;

            if (match[1])
                return this.openingBracketBlock(session, match[1], row, i);
                
            var range = session.getCommentFoldRange(row, i + match[0].length, 1);
            
            if (range && !range.isMultiLine()) {
                if (forceMultiline) {
                    range = this.getSectionRange(session, row);
                } else if (foldStyle != "all")
                    range = null;
            }
            
            return range;
        }

        if (foldStyle === "markbegin")
            return;

        var match = line.match(this.foldingStopMarker);
        if (match) {
            var i = match.index + match[0].length;

            if (match[1])
                return this.closingBracketBlock(session, match[1], row, i);

            return session.getCommentFoldRange(row, i, -1);
        }
    };
    
    this.getSectionRange = function(session, row) {
        var line = session.getLine(row);
        var startIndent = line.search(/\S/);
        var startRow = row;
        var startColumn = line.length;
        row = row + 1;
        var endRow = row;
        var maxRow = session.getLength();
        while (++row < maxRow) {
            line = session.getLine(row);
            var indent = line.search(/\S/);
            if (indent === -1)
                continue;
            if  (startIndent > indent)
                break;
            var subRange = this.getFoldWidgetRange(session, "all", row);
            
            if (subRange) {
                if (subRange.start.row <= startRow) {
                    break;
                } else if (subRange.isMultiLine()) {
                    row = subRange.end.row;
                } else if (startIndent == indent) {
                    break;
                }
            }
            endRow = row;
        }
        
        return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
    };
    this.getCommentRegionBlock = function(session, line, row) {
        var startColumn = line.search(/\s*$/);
        var maxRow = session.getLength();
        var startRow = row;
        
        var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
        var depth = 1;
        while (++row < maxRow) {
            line = session.getLine(row);
            var m = re.exec(line);
            if (!m) continue;
            if (m[1]) depth--;
            else depth++;

            if (!depth) break;
        }

        var endRow = row;
        if (endRow > startRow) {
            return new Range(startRow, startColumn, endRow, line.length);
        }
    };

}).call(FoldMode.prototype);

});

define("ace/mode/aiscript",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/aiscript_highlight_rules","ace/mode/folding/cstyle"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var AIScriptHighlightRules = require("./aiscript_highlight_rules").AIScriptHighlightRules;
var FoldMode = require("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = AIScriptHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/aiscript"
}).call(Mode.prototype);

exports.Mode = Mode;
});
