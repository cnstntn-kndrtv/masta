/**
 * Инициализация и запуск редктора ACE в #editor-container
 */
var editor, EditSession, nlpsession, Tokenizer, BackgroundTokenizer, bgTokenizer, Range, Search, search;
function initACE(){
    var container = document.getElementById('editor-container');
    var demoTxt = "Сколько можно съесть слонов? Можно скушать сто килов.";

    editor = ace.edit(container);
    EditSession = ace.require("ace/edit_session").EditSession;
    nlpsession = new EditSession(demoTxt);
    editor.setSession(nlpsession);

    // options
    // тема
    editor.setTheme("ace/theme/katzenmilch");
    
    // это кастомное правило подсветки синтакиса
    // подсвечивает каждое отдельно стоящее слово
    // нужно для выделения по наведению (события редактора ниже в этой же функции)
    editor.session.setMode("ace/mode/single-words-tokens");

    editor.setOptions({
        // фокус страницы на редакторе
        autoScrollEditorIntoView: true,
        // размер шрифта
        fontSize: 14,
        // перенос по словам
        wrap: true,
        // подсвечивать активную линию
        highlightActiveLine: false,
        // подсвечивать выделенное слово
        highlightSelectedWord: true,
        // показывать скрытые символы
        showInvisibles: false,
        // БОКОВАЯЯ ПАНЕЛЬ (СЛЕВА)
        // показывать боковую панель
        showGutter: false,
        // показывать номера строк
        showLineNumbers: false,
        // показывать стрелки свертывание функций
        showFoldWidgets: false,
        
    });

    // автоматичекое обновление редактора, если включен чекбокс
    var refreshmodechechbox = document.getElementById("refreshmode");
    nlpsession.on("change", function(){
        if(refreshmodechechbox.checked) analyzeText();
    });

    // для обновления подсветки синтаксиса
    Tokenizer = ace.require("ace/tokenizer").Tokenizer;
    BackgroundTokenizer = ace.require("ace/background_tokenizer").BackgroundTokenizer;
    bgTokenizer = new BackgroundTokenizer(nlpsession);

    // для подсветки слов
    Range = ace.require("ace/range").Range;
    Search = ace.require("ace/search").Search;
    search = new Search();

    // события редактора
    // токены берутся из режима редактора. по-этому подключен режим single-words-token
    
    // левая кнопка мыши
    // editor.on("click", function(){
    //     console.log("ok");
    // })

    // правая кнопка мыши
    // editor.container.addEventListener('contextmenu', function(event) {
    //     event.preventDefault();
    //     var position = editor.getCursorPosition();
    //     var token = editor.session.getTokenAt(position.row, position.column);
    //     console.log(token.value);
    //     return false;
    // }, false);

    // при наведении на слово
    // editor.on('mousemove', function(event) {
    //      var position = event.editor.getCursorPosition();
    //      var token = editor.session.getTokenAt(position.row, position.column);
    //      console.log(token.value);
    //      console.log(position.row, position.column);
    //      console.log("selection:", getSelection());
    // });
}

initACE();

/**
 * запускает анализатор текста в зависимости от выбранного типа в чек-боксе
 */
$('#analyseTextButton').click(() => getTextInfo());

class MyEventEmitter {
    on(type, cb) {
        this['_on' + type] = this['_on' + type] || [];
        this['_on' + type].push(cb);
    }
    emit(type, args) {
        this['_on' + type] && this['_on' + type].forEach((cb) => cb(args));
    }
}

class QueryWorker extends MyEventEmitter {
    constructor(params) {
        super();
        this._w = new Worker('js/ldf-client/ldf-client-worker.js');
        this._timeOut = params.timeOut || 20000;
        this._config = params;
        this._hasResults = false;

        this._w.onmessage = (m) => {
            let data = m.data;
            switch (data.type) {
                case 'result':
                    this._addResults(data.result);
                    break;
                case 'log':
                    this._log(data.log);
                    break;
                case 'error':
                    this._w.onerror(data.error);
                    break;
                case 'bye':
                    this.emit('bye');
                    break;
            }
        }

        this._w.onerror = (e) => {
            this._w.onerror = $.noop;
            console.log('Error', e);
            ++ec;
            this._addResults([]);
            this._destroy();
        }
    }

    start() {
        this._startTimer();
        this._w.postMessage({ type: 'query', data: this._config }); 
    }

    _startTimer() {
        setTimeout(() => {
            if ( !this._hasResults ) {
                console.log('------time out');
                this._w.onerror('time out');
            }
        }, this._timeOut);
    }

    _addResults(r) {
        this._hasResults = true;
        this.emit('data', r);
    }

    _log(l) {
        console.log('-- log', l);
    }

    _destroy() {
        this._w.postMessage({ type: 'destroy' });
    }
}

class Results extends MyEventEmitter {
    constructor (headers, firstHeader) {
        super();
        this._db = [];
        this._headers = headers;
        this._firstHeader = firstHeader;
        this._headers.unshift(this._firstHeader);
        this.emit('init', headers);
    }

    clear() {
        this._db = [];
        this.emit('clear');
    }

    getHeaders() {
        return this._headers;
    }

    addWords(words) {
        words.forEach((word) => {
            let record = {};
            this._headers.forEach((key) => {
                if (key == this._firstHeader) record[key] = word;
                else record[key] = null;
            })
            this._db.push(record);
        });
        this.emit('addWords');
    }

    addCell(props) {
        for(let i = 0, l = this._db.length; i < l; i++) {
            if (this._db[i][this._firstHeader] == props.word) {
                this._db[i][props.type] = props.content;
                this.emit('addCell', props);
                break;
            }
        }
    }
}

class ResultsTable {
    constructor(results, container) {
        this._res = results;
        this._headers = this._res.getHeaders();
        this._container = container;
        this._createTable();

        this._res.on('addWords', () => this._addWords());
        this._res.on('addCell', (props) => this._add(props));
    }
    
    _createTable() {
        this._table = d3.select(this._container)
                        .append('div')
                            .attr('class', 'table-responsive')
                            .append('table')
                                .attr('class', 'table table-hover table-condensed');
        this._thead = this._table.append('thead');
        this._tbody = this._table.append('tbody');

        this._thead.append('tr')
            .selectAll('th')
            .data(this._headers)
            .enter()
                .append('th')
                    .text((h) => {return h});
    }

    _addWords() {
        this._rows = this._tbody.selectAll('tr')
            .data(this._res._db)
            .enter()
            .append('tr');
        
        this._cells = this._rows.selectAll('td')
            .data((row) => {
                return this._headers.map((h) => {
                    return {header: h, value: row[h], word: row[this._res._firstHeader]};
                });
            })
            .enter()
            .append('td')
                .append('div')
                    .text((d) => {
                        return d.value
                    })
                    .attr('id', (d) => {
                        let id = d.word + '_' + d.header;
                        return id;
                    })
                    .attr('class', (d) => {
                        if (d.value != d.word) return 'loader';
                        else return '';
                    });
    }

    _addCell(props) {
        let id = '#' + props.word + '_' + props.type;
        d3.select(id)
            .classed('loader', false)
            .text(props.content);
    }

}

/**
 * создание элементов для d3
 * TODO kill me
 */
function createElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

// let headers = ['Морфология', 'Произношение', 'Значение'];
// let firstHeader = 'Слово';
// let results = new Results(headers, firstHeader);
// let table = new ResultsTable(results, '#words-container');

// start
// results.clear();

// let words = new Set;
// let morpCache = new Map;

// words.add('one');
// words.add('two');
// words.add('three');

// results.addWords(words);

// morpCache.set('one', {'Морфология': {a: 1}});
// morpCache.set('two', {'Морфология': {a: 2}});

// let type = 'Морфология';
// words.forEach((w) => {
//     let r;
//     if (morpCache.has(w)) {
//         r = morpCache.get(w);
//     } else {
//         r = fakeSearch(w);
//         morpCache.set(w, r);
//     }
//     results.addCell({word: w, type: type, content: r[type]});
// })

// results.addCell({word: 'three', type: 'Значение', content: '73984273947'});

// function fakeSearch(word){
//     let db = {
//         'three': {'Морфология': {a: 3}},
//         'four': {'Морфология': {a: 4}}
//     }
//     if (db[word]) return db[word];
//     else return false;
// }

// let wordsMeaning = new Map;
// let wordsMorpology = new Map;

/**
 * максимальное количество воркеров
 */
let maxWorkers = navigator.hardwareConcurrency || 2;

/**
 * возвращает литерал текстовой строки rdf
 */
function getLiteral(l) {
    return (l) ? N3.Util.getLiteralValue(l) : null;
}

/**
 * доступное количество воркеров
 */
let availableWorkers = maxWorkers;


function getTextInfo_OLD() {
    let tokenTypes = ["WORD.CYRIL"];
    let tokens = Az.Tokens(nlpsession.getDocument().getValue()).done(tokenTypes);
    let words = new Map;
    if (tokens.length != 0 ) {
        // createResultTable(tokens);
        tokens.forEach((t) => {
            words.set(t.toString().toLowerCase());
        })
        words.forEach((word) => {
            let query = 'PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#> \
                    PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> \
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \
                    SELECT DISTINCT ?liFormP ?liFormO ?lemmaWr ?liLemmaP ?liLemmaO \
                    WHERE { \
                        ?form ontolex:writtenRep "' + word + '"@ru . \
                        { ?form ?liFormP ?liFormO . \
                            FILTER( REGEX( STR(?liFormP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                        } \
                        UNION \
                        { ?word ontolex:otherForm ?form ; \
                            ontolex:canonicalForm ?lemmaID . \
                            OPTIONAL { \
                                ?lemmaID ontolex:writtenRep ?lemmaWr . \
                                ?lemmaID ?liLemmaP ?liLemmaO . \
                                FILTER( REGEX( STR(?liLemmaP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                            } \
                        } \
                    }';
            let params = {
                datasource: 'http://ldf.kloud.one/ontorugrammaform',
                queries: [query]
            }
            let w = new QueryWorker(params);
            w.start();
            w.on('end', (res) => {
                if (res.length == 0) {
                    wordsMorpology.set(word, null);
                } else {
                    wordsMorpology.set(word, res);
                }
            })
        })
    }
}

// TODO kill me
var n = 0, ec = 0;

let headers = ['Морфология', 'Лемма', 'Произношение'];
let firstHeader = 'Слово';
let results = new Results(headers, firstHeader);
let table = new ResultsTable(results, '#words-container');

function getTextInfo() {
    let maxQueriesInEachWorker = Math.ceil(stars.length / maxWorkers);
    let queries = [];
    
    // TODO kill me
    // let words = stars;
    console.time('stars');
    let tokenTypes = ["WORD.CYRIL"];
    let tokens = Az.Tokens(nlpsession.getDocument().getValue()).done(tokenTypes);
    let words = new Set;
    if (tokens.length != 0 ) {
        tokens.forEach((t) => {
            words.add(t.toString().toLowerCase());
        })
        words = Array.from(words);
        results.clear();
        results.addWords(words);
        for (let i = 0, l = words.length, word = ''; i < l; i++) {
            word = words[i];
            queries.push({
                id: word,
                query: 'PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#> \
                        PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> \
                        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \
                        SELECT DISTINCT ?formP ?formO ?lemmaWr ?lemmaP ?lemmaO \
                        WHERE { \
                            ?formId ontolex:writtenRep "' + word + '"@ru . \
                            { ?formId ?formP ?formO . \
                                FILTER( REGEX( STR(?formP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                            } \
                            UNION \
                            { ?wordId ontolex:otherForm ?formId ; \
                                ontolex:canonicalForm ?lemmaId . \
                                OPTIONAL { \
                                    ?lemmaId ontolex:writtenRep ?lemmaWr . \
                                    ?lemmaId ?lemmaP ?lemmaO . \
                                    FILTER( REGEX( STR(?lemmaP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                                } \
                            } \
                        }',
            });
            if (queries.length == maxQueriesInEachWorker) {
                startRequests(queries);
                queries = [];
            } else if (i+1 == l) startRequests(queries);
        }
    }
}

function startRequests(queries) {
    let params = {
        datasource: 'http://ldf.kloud.one/ontorugrammaform',
        queries: queries,
    }
    let w = new QueryWorker(params);
    
    // TODO kill me
    ++n;
    
    w.start();
    w.on('data', (res) => {
        if (res.data.length == 0) {
            console.log('no results sorry');
        } else {
            let morph = {};
            res.data.forEach((r) => {
                let formO = r['?formO'],
                    formP = r['?formP'],
                    lemmaO = r['?formO'],
                    lemmaP = r['?formP'];
                if (formP && formO) morph[formP] = formO;
                if (lemmaP && lemmaO) morph[lemmaP] = lemmaO;
                let isLemma = false;
                if (r['?lemmaWr'] && !isLemma) {
                    let lemma = getLiteral(r['?lemmaWr']);
                    results.addCell({word: res.id, type: 'Лемма', content: lemma});
                    isLemma = false;
                }
            });
            results.addCell({word: res.id, type: 'Морфология', content: getLiTags(morph)});
        }
    });
    
    w.on('bye', () => {
        --n;
        console.log(n);
        if (n == 0) {
            console.timeEnd('stars');
            console.log(ec);
        }
    });
}

function getLiTags(tags) {
    let str = '';
    for (let key in tags) {
        if (tags.hasOwnProperty(key)) {
            let element = tags[key];
            str += lexInfoTagsDescription[element].label + ', ';
        }
    }
    return str;
}





/**
 * скроллит экран к элементу
 * @param  {string} element id элемента, которому нужно скроллить
 */
function scrollTo(element) {
    $('html, body').animate({scrollTop: $(element).offset().top-60}, 500);
}

/**
 * устанавливает текст заголовка окна с результатами анализа текста
 * @param  {string} header
 */
function changeResultsHeading(header) {
    document.getElementById("results-heading").innerText = header;
}

// МОРФОЛОГИЯ
/**
 * обновляет подсветку синтаксиса тегами результатов Морфлогоческого анализа для ACE 
 */
function updateACEModeMorph() {
    var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
    var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
    var rules = new TextHighlightRules;
    // собираются теги из документа в редакторе
    var parse = getMorphTags(nlpsession.getDocument().getValue());
    //debugger;
    if (parse.length != 0) {
        if (parse[0].length != 0) {
            // обновляется список в таблице со словами
            updateMorphWordsList(parse);
            // обновляется подсветка
            rules.addRules(getMorphACEModeRules(parse));
            rules.normalizeRules();
            rules = rules.getRules();
            var tok = new Tokenizer(rules);
            nlpsession.bgTokenizer.setTokenizer(tok);
        } else updateMorphWordsList(null, true); // если в редакторе пусто 
    } else updateMorphWordsList(null, true); // если в редакторе пусто
}

/**
 * Создает правила подсветки синтаксиса Морфологического анализа для ACE редактора
 * @param  {Array.Array.Object} parse
 * @returns {Object} rule
 *   @returns {Object.Array.Object} rule.start содержит массив объектов со список всех слов в правиле {include: word}
 *   @returns {Object.Array.Object} rule.word содержит объект с описаним тегов и регекспа для этого слова
 *     @returns {Object.Array.Object} ule.word[0]["token"] токен для редактора, через точку перечислены все теги
 *     @returns {Object.Array.Object} ule.word[0]["regex"] регексп со словом /word/
 */
function getMorphACEModeRules(parse) {
    // выводится только 1й элемент массива parse, т.к содержит наиболее вероятный вариант
    // составление правила
    var rule = {};
    rule.start = [];
    var word,
        token,
        regex,
        wordRule;
    for (var i = 0, parseLen = parse.length; i < parseLen; i++) {
        if (parse[i][0]) {
            word = parse[i]["origWord"];
            // rule.start с инклудами правил
            rule.start.push({ include: word });
            // название класса CSS
            token = "MORPH.morph_" + parse[i][0]["tag"]["POST"];
            regex = new RegExp("(?!\\s+)" + word + "(?![\\wа-я-]+)");
            wordRule = [
                {
                    token: token,
                    regex: regex,
                    //caseInsensitive: true,
                }
            ]
            rule[word] = wordRule;
        }
    }
    return rule;
}

/**
 * возвращает результаты морфологического анализа
 * @param  {string} text
 * @returns {Array.Array.Object} parse
 */
function getMorphTags(text) {
    // типы токенов для морф. анализа
    var tokenTypes = ["WORD"];
    // разбиение слова на токены
    var tokens = Az.Tokens(text).done(tokenTypes);
    var parse = [];
    var morph;
    // получение морф. тегов для каждого токена
    tokens.map(function (token) {
        morph = Az.Morph(token.toString(), {
            // опечатки 
            typos: 'auto',
            stutter: Infinity,
            ignoreCase: true,
        }); 
        // добавление исходного слова в объект (Az.Morph возвращает слово с исправлениями и в нижнем регистре)
        morph.origWord = token.toString();
        parse.push(morph);
    });
    return parse;
}

/**
 * создает строчку с тегами на русском языке + tooltip с полным описаним из tagsDescription
 * после создания для всех слов, нужно инициализировать тултипы в вызывающей функции $('[data-toggle="tooltip"]').tooltip(); 
 * переменная morphTagDescription - глобальная, грузится из внешнего файла
 * @param  {obj} tags теги на русском языке, разделены запятой
 * @returns {string} result html span
 */
function createMorphTagsString(tags) {
    let result = '';
    for (tag in tags) {
        if(typeof(tags[tag]) == "boolean") {
            result += '<span style="cursor: pointer" data-toggle="tooltip" data-placement="top" container="body" title="' + morphTagsDescription[tag] + '">[' + tag + ']</span>';
        }
    }
    return result;
}

/**
 * обнвляет список слов с результатами Морфологического анализа текста
 * @param  {Object} parse
 * @param  {[boolean]} hideResults если установлен - скрывает таблицу с результатами 
 */
function updateMorphWordsList(parse, hideResults) {
    var wordsContainer = document.getElementById("words-container");
    changeResultsHeading("Результаты морфологического анализа (наибольшая вероятность)")
    if (hideResults) {
        wordsContainer.innerHTML = "";
        return;
    } 
    var wordsContent = "";
    var str,
        origWord,
        correctedWord,
        tagStr,
        badge;

    for (var i = 0, l = parse.length; i < l; i++) {
        if (parse[i][0]) {
            origWord = parse[i]["origWord"];
            correctedWord = parse[i][0]["word"];
            tagStr = createMorphTagsString(parse[i][0]["tag"]["ext"]);
            badge = '<span class="badge ace_MORPH ace_morph_' + parse[i][0]["tag"]["POST"] + '">' + parse[i][0]["tag"]["ext"]["POST"] + '</span>';
            str =
                '<tr>\
                    <td>\
                        <a style="cursor: pointer" onclick="scrollTo(\'#single-word\'); document.getElementById(\'single-word\').value = \'' + origWord + '\'; document.getElementById(\'single-word\').focus();">'
                            + origWord +
                        '</a>\
                    </td>\
                    <td>'
                        + correctedWord +
                    '</td>\
                    <td>'
                        + badge +
                    '</td>\
                    <td>'
                        + tagStr +
                    '</td>\
                    <td>'
                        + (parse[i][0].stutterCnt || 0) +
                    '</td>\
                    <td>'
                        + (parse[i][0].typosCnt || 0) +
                    '</td>\
                    <td>'
                        + (parse[i][0].stutterCnt || 0) +
                    '</td>\
                </tr>';

            wordsContent += str;
        }
    }
    wordsContainer.innerHTML = '<div class="table-responsive">\
                                    <table class="table table-hover table-condensed">\
                                        <thead>\
                                            <tr>\
                                                <th>Слово</th>\
                                                <th>Исправление</th>\
                                                <th>Части речи</th>\
                                                <th>Все теги</th>\
                                                <th>Испр. повторов</th>\
                                                <th>Испр. опечаток</th>\
                                                <th>Испр. заиканий</th>\
                                            </tr>\
                                        </thead>\
                                        <tbody>' + wordsContent + '</tbody>\
                                    </table>\
                                </div>';

    $('[data-toggle="tooltip"]').tooltip();
}

// ТОКЕНИЗАЦИЯ
/**
 * обновляет подсветку синтаксиса тегами результатов Токенизации текста для ACE 
 */
function updateACEModeToken(){
    var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
    var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
    var rules = new TextHighlightRules;
    // собираются теги из документа в редакторе
    var tokens = getTokenTags(nlpsession.getDocument().getValue());
    if (tokens.length != 0) {
        // обновляется список в таблице со словами
        updateTokenWordsList(tokens);
        // обновляется подсветка
        rules.addRules(getTokensACEModeRules(tokens));
        rules.normalizeRules();
        rules = rules.getRules();
        var tok = new Tokenizer(rules);
        nlpsession.bgTokenizer.setTokenizer(tok);
    } else updateMorphWordsList(null, true); // если в редакторе пусто
}

/**
 * возвращает токены текста
 * @param  {string} text
 * @returns {Array.Object} tokens
 */
function getTokenTags(text) {
    var tokens = Az.Tokens(text).done();
    return(tokens);
}

/**
 * Создает правила подсветки синтаксиса Токенизации для ACE редактора
 * @param  {Array.Object} tokens
 * @returns {Object} rule
 *   @returns {Object.Array.Object} rule.start содержит массив объектов со список всех слов в правиле {include: word}
 *   @returns {Object.Array.Object} rule.word содержит объект с описаним тегов и регекспа для этого слова
 *     @returns {Object.Array.Object} ule.word[0]["token"] токен для редактора, через точку перечислены все теги
 *     @returns {Object.Array.Object} ule.word[0]["regex"] регексп со словом /word/
 */
function getTokensACEModeRules(tokens) {
    // выводится только 1й элемент массива parse, т.к содержит наиболее вероятный вариант
    // составление правила
    var rule = {};
    rule.start = [];
    var word,
        tokenType,
        tokenSubType,
        token,
        regex,
        wordRule;
    for (var i = 0, l = tokens.length; i < l; i++) {
        if (tokens[i]) {
            word = tokens[i].toString();
            if (word) {
                // rule.start с инклудами правил
                rule.start.push({ include: word });
                // названия классов CSS для тега и саб тега
                tokenType = tokens[i].type ? ".token_" + tokens[i].type.toString() : "";
                tokenSubType = tokens[i].subType ? ".token_" + tokens[i].subType.toString() : "";
                token = "TOKENS" + tokenType + tokenSubType;
                if (tokenType != ".token_SPACE" && tokenType != ".token_PUNCT" && tokenType != ".token_OTHER") {
                    regex = new RegExp("(?!\\s+)" + word + "(?![\\wа-я-]+)");
                } else regex = new RegExp("\\" + word);
                
                wordRule = [
                    {
                        token: token,
                        regex: regex,
                        //caseInsensitive: true,
                    }
                ]
                rule[word] = wordRule;
            }
        }
    }
    return rule;
}

/**
 * обнвляет список слов с результатами Токенизации текста
 * @param  {Object} parse
 * @param  {[boolean]} hideResults если установлен - скрывает таблицу с результатами 
 */
function updateTokenWordsList(tokens, hideResults) {
    var wordsContainer = document.getElementById("words-container");
    changeResultsHeading("Результаты токенизации текста")
    if (hideResults) {
        wordsContainer.innerHTML = "";
        return;
    }
    var wordsContent = "";
    var str,
        word,
        tokenType,
        tokenSubType,
        tokenTypeClazz,
        tokenSubTypeClazz,
        tagStr,
        badge;

    for (var i = 0, l = tokens.length; i < l; i++) {
        if (tokens[i]) {
            word = tokens[i].toString();
            // названия токена и субтокена
            tokenType = tokens[i].type ? tokens[i].type.toString() : false;
            tokenSubType = tokens[i].subType ? tokens[i].subType.toString() : false;
            // классы css для подсветки
            tokenTypeClazz = tokenType ? "ace_token_" + tokenType : "";
            tokenSubTypeClazz = tokenSubType ? "ace_token_" + tokenSubType : "";
            // строчка с названиями тега и сабтега
            tagStr = '<span>' + (tokenType ? '[' + tokenType + ']' : "") + (tokenSubType ? '[' + tokenSubType + ']' : "") + '</span>';
            badge = '<span class="badge ace_TOKENS ' + tokenTypeClazz + '">' + tokenType + '</span>';
            str =
                '<tr>\
                    <td>"' + word + '"</td>\
                    <td>'
                        + badge +
                    '</td>\
                    <td>'
                        + tagStr +
                    '</td>\
                </tr>';

            wordsContent += str;
        }
    }

    wordsContainer.innerHTML = '<table class="table table-hover table-condensed">\
                                    <thead>\
                                        <tr>\
                                            <th>Слово</th>\
                                            <th>Основной тег</th>\
                                            <th>Все теги</th>\
                                        </tr>\
                                    </thead>\
                                    <tbody>' + wordsContent + '</tbody>\
                                </table>';

}

// ЭМОЦИИ
function updateACEModeSentiment(){
    updateMorphWordsList(null, true);
}


// МОРФОЛОГИЧЕСКИЙ АНАЛИЗ 1 СЛОВА
/**
 * показывает панель с результатами анализа 1 слова
 */
function showSingleWordVariants(){
    document.getElementById("single-word-variants").style.visibility = "visible";
}

/**
 * обновляет таблицу с результатами Морф. анализа одного слова
 * слов берет из инпута #single-word
 */
function updateSingleWordMorphVariants() {
    var variants = Az.Morph(document.getElementById('single-word').value, { typos: 'auto' });
    var container = document.getElementById("single-word-variants-results");
    var content = "";
    var str;
    var formsLink;
    var allForms = "";
    var allFormContainer;
    var allFormsList;
    var allFormsListRow;
    for (var i = 0, l = variants.length; i < l; i++) {
        if (variants[i].formCnt) formsLink = '<a style="cursor: pointer" onclick="showAllForms(' + i + ')">' + variants[i].formCnt + ' ' + Az.Morph('форма')[0].pluralize(variants[i].formCnt) + '</a>';
        else formsLink = 'Нет форм';
        str =   '<tr>\
                    <td>' + variants[i] + '</td>\
                    <td>' + Math.floor(variants[i].score.toFixed(6) * 100) + '% </td>\
                    <td>' + variants[i].parser + '</td>\
                    <td>' + createMorphTagsString(variants[i].tag.ext) + '</td>\
                    <td>' + variants[i].tag + '</td>\
                    <td>' + variants[i].normalize() + '</td>\
                    <td>' + variants[i].normalize(true) + '</td>\
                    <td>' + (variants[i].stutterCnt || 0) + '</td>\
                    <td>' + (variants[i].typosCnt || 0) + '</td>\
                    <td>' + formsLink +'</td>\
                </tr>';
        // составление списка всех форм каждого варианта слова
        allFormsList = "";
        for (var f = 0, n = 0; f < variants[i].formCnt; f++) {
            var form = variants[i].inflect(f)
            n = f + 1;
            allFormsListRow =  '<tr>\
                                    <td>' + n + '</td>\
                                    <td>' + form + '</td>\
                                    <td>' + createMorphTagsString(form.tag.ext) + '</td>\
                                </tr>';

            allFormsList += allFormsListRow;
        }

        // создание модельного окна со списком всех форм для каждого варианта слова
        allFormContainer = '<div class="modal" id="allForms-' + i + '">\
                                <div class="modal-dialog">\
                                    <div class="modal-content">\
                                        <div class="modal-header">\
                                            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>\
                                            <h4 class="modal-title">Формы слова "' + variants[i] + '" (' + variants[i].formCnt + ')</h4>\
                                        </div>\
                                        <div class="modal-body">\
                                            <div class="scrollable" id="all-forms-table">\
                                                <table class="table">\
                                                    <thead>\
                                                        <tr>\
                                                            <td></td>\
                                                            <td>Слово</td>\
                                                            <td>Граммемы</td>\
                                                        </tr>\
                                                    </thead>\
                                                    <tbody>' + allFormsList + '</tbody>\
                                                </table>\
                                            </div>\
                                        </div>\
                                        <div class="modal-footer">\
                                            <button type="button" class="btn btn-default" data-dismiss="modal">Закрыть</button>\
                                        </div>\
                                    </div>\
                                </div>\
                            </div>';

    content += str;
    allForms += allFormContainer
    }
    container.innerHTML =   '<div class="table-responsive">\
                                <table class="table table-hover">\
                                    <thead>\
                                        <tr>\
                                            <th>Слово</th>\
                                            <th>%</th>\
                                            <th>Парсер</th>\
                                            <th>Граммемы</th>\
                                            <th>Граммемы (англ.)</th>\
                                            <th>Нач.форма</th>\
                                            <th>Нач.форма(та же ч.р.)</th>\
                                            <th>Испр. повторов</th>\
                                            <th>Испр опечаток</th>\
                                            <th>Все формы слова</th>\
                                        </tr>\
                                    <tbody>' + content + '</tbody>\
                                </tabe>\
                            </div>';
    document.getElementById("single-word-modals").innerHTML = allForms;
    $('[data-toggle="tooltip"]').tooltip();
}

/**
 * показывает модульное окно со всеми формами одного слова
 * окно создается в функции updateSingleWordMorphVariants
 * @param  {number} i - номер окна #allForms-i
 */
function showAllForms(i){
    var formId = "#allForms-" + i;
    $(formId).modal('show');
    console.log(formId);
}

