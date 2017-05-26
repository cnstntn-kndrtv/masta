ace.define('ace/mode/single-words-tokens', function (require, exports, module) {

    var oop = require("ace/lib/oop");
    var TextMode = require("ace/mode/text").Mode;
    var swtHighlightRules = require("ace/mode/single-words-tokens-highlight-rules").swtHighlightRules;

    var Mode = function () {
        this.HighlightRules = swtHighlightRules;
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.$id = "ace/mode/single-words-tokens"
    }).call(Mode.prototype);

    exports.Mode = Mode;
});


ace.define('ace/mode/single-words-tokens-highlight-rules', ["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function (require, exports, module) {

    var oop = require("ace/lib/oop");
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    var swtHighlightRules = function () {
        this.$rules = new TextHighlightRules().getRules();
        this.$rules = {
            start: [
                {include: "#single-word"},
            ],
            "#single-word": [
                {
                    token: "single-word",
                    regex: /[\wа-я-`]+/,
                    caseInsensitive: true,
                }
            ]
        };

        this.normalizeRules();
    }
    swtHighlightRules.metaData = {
        name: "single-words-tokens",
        scopeName: "text.single-words-tokens"
    }

    oop.inherits(swtHighlightRules, TextHighlightRules);

    exports.swtHighlightRules = swtHighlightRules;
});