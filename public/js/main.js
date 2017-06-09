/**
 * Инициализация и запуск редктора ACE в #editor-container
 */
var demoTxt = 'Выставка "Человек как птица. Образы путешествий" исследует вопросы новых открытий на стыке оптики и искусства, в тех сферах, которые объединены стремлением человека к познанию мира и определению своего места в нем.'
var editor, EditSession, nlpsession, Tokenizer, BackgroundTokenizer, bgTokenizer, Range, Search, search;
function initACE(){
    let container = document.getElementById('editor-container');

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
    let refreshmodechechbox = document.getElementById("refreshmode");
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
            // this._w.onerror = $.noop;
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

    addWords(words) {
        words.forEach((word) => {
            let record = {};
            this._headers.forEach((key) => {
                if (key == this._firstHeader) {
                    record[key] = word;
                    record['id'] = word;
                }
                else record[key] = 'loading';
                record['found'] = undefined;
            })
            this._db.push(record);
        });
        this.emit('addWords');
    }

    addCell(props) {
        for(let i = 0, l = this._db.length; i < l; i++) {
            if (this._db[i].id == props.word) {
                this._db[i][props.type] = props.content;
                this.emit('addCell', props);
                if (props.type == 'liTags') getLiPOSClass(props);
                if (props.type == 'posClass') updateACEMode(this._db);
                break;
            }
        }
    }

    get(word) {
        let res = undefined;
        if (word) {
            this._db.forEach((d) => {
                if (word == d.id) res = d;
            });
        }
        return res;
    }
}

class ResultsTable {
    constructor(results, container) {
        this._res = results;
        this._headers = this._res._headers;
        this._container = container;
        this._createTable();

        this._res.on('addWords', () => this._update());
        this._res.on('addCell', (props) => this._update(props));

        this._loadingText = '';
        this._noResultsText = '🛠';
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

    _update() {
        this._rows = this._tbody.selectAll('tr')
            .data(this._res._db);
        
        this._rows.enter()
            .append('tr')
            .selectAll('td')
            .data((row) => {
                return this._headers.map((h) => {
                    return {header: h, value: row[h], word: row[this._res._firstHeader]};
                });
            })
            .enter()
            .append('td')
            .append('div')
                .text((d) => {
                    if (d.value == 'loading') return this._loadingText;
                    else if (!d.value) return this._noResultsText;
                    else return d.value;
                })
                .attr('class', (d) => {
                            if (d.value == 'loading') return 'loader';
                            else return '';
                        });
        
        this._rows.exit().remove();
        
        this._cells = this._rows.selectAll('td')
            .data((row) => {
                return this._headers.map((h) => {
                    return {header: h, value: row[h], word: row[this._res._firstHeader]};
                });
            })
            .select('div')
                .text((d) => {
                    if (d.value == 'loading') return this._loadingText;
                    else if (!d.value) return this._noResultsText;
                    else return d.value;
                })
                    .attr('class', (d) => {
                                if (d.value == 'loading') return 'loader';
                                else return '';
                            });
        
        this._cells.enter()
            .append('td')
            .append('div')
            .text((d) => {
                if (d.value == 'loading') return this._loadingText;
                else if (!d.value) return this._noResultsText;
                else return d.value;
            })
                .attr('class', (d) => {
                            if (d.value == 'loading') return 'loader';
                            else return '';
                        });
        
        this._cells.exit().remove();

    }

}

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

// console.time
var n = 0, ec = 0;

let headers = ['Морфология', 'Лемма', 'Произношение'];
let firstHeader = 'Слово';
let results = new Results(headers, firstHeader);
let table = new ResultsTable(results, '#words-container');

function getTextInfo() {
    let maxQueriesInEachWorker = Math.ceil(stars.length / maxWorkers);
    let queries = [];
    
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
                        SELECT DISTINCT ?formP ?formO ?lemmaWr ?lemmaP ?lemmaO ?phoneticRep \
                        WHERE { \
                            ?formId ontolex:writtenRep "' + word + '"@ru . \
                            { ?formId ?formP ?formO . \
                                FILTER( REGEX( STR(?formP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                            } \
                            UNION \
                            {?formId ontolex:phoneticRep ?phoneticRep .} \
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
    
    // console.time
    ++n;
    
    w.start();
    w.on('data', (res) => {
        if (!res.data || res.data.length == 0) {
            results.addCell({word: res.id, type: 'Лемма', content: null});
            results.addCell({word: res.id, type: 'Произношение', content: null});
            results.addCell({word: res.id, type: 'Морфология', content: null});
            results.addCell({word: res.id, type: 'found', content: 'no'});
        }
        else {
            let morph = {},
                lemmaWr,
                phoneticRep;
            res.data.forEach((r) => {
                let formO = r['?formO'],
                    formP = r['?formP'],
                    lemmaO = r['?lemmaO'],
                    lemmaP = r['?lemmaP'];
                
                if (formP && formO) morph[formP] = formO;
                if (lemmaP && lemmaO) morph[lemmaP] = lemmaO;

                let isLemmaAdded = false;
                if (r['?lemmaWr'] && !isLemmaAdded) {
                    lemmaWr = getLiteral(r['?lemmaWr']);
                    
                    // TODO kille me!
                    if (res.id == 'можно') {
                        lemmaWr = undefined;
                    }
                    
                    isLemmaAdded = true;
                }
                let isPhoneticRepAdded = false;
                if (r['?phoneticRep'] && !isPhoneticRepAdded) {
                    phoneticRep = getLiteral(r['?phoneticRep']);
                    isPhoneticRepAdded = true;
                }
            });
            results.addCell({word: res.id, type: 'Лемма', content: lemmaWr || undefined});
            results.addCell({word: res.id, type: 'Произношение', content: phoneticRep  || undefined});
            results.addCell({word: res.id, type: 'Морфология', content: lexInfoTagsToString(morph)});
            results.addCell({word: res.id, type: 'liTags', content: morph});
            results.addCell({word: res.id, type: 'found', content: 'yes'});
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

function lexInfoTagsToString(tags) {
    let str = '';
    let label, comment;
    let size = Object.keys(tags).length;
    let i = 0, lineEnd;
    for (let key in tags) {
        if (tags.hasOwnProperty(key)) {
            i++;
            let element = tags[key];
            lineEnd = (i < size) ? ', ' : '';
            let t = lexInfoTagsDescription[element];
            label = (t) ? lexInfoTagsDescription[element].label : '';
            comment = (t) ? lexInfoTagsDescription[element].comment : '';
            str += label + lineEnd;
            //str += '<span style="cursor: pointer" data-toggle="tooltip" data-placement="top" container="body" title="' + comment + '">[' + label + ']</span>';
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

var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
var rules = new TextHighlightRules;
function updateACEMode(words) {
    rules.addRules(getACEModeRules(words));
    rules.normalizeRules();
    let r = rules.getRules();
    let tok = new Tokenizer(r);
    nlpsession.bgTokenizer.setTokenizer(tok);
}

/**
 * Создает правила подсветки синтаксиса Морфологического анализа для ACE редактора
 * @param  {Array.Array.Object} parse
 * @returns {Object} rule
 *   @returns {Object.Array.Object} rule.start содержит массив объектов со список всех слов в правиле {include: word}
 *   @returns {Object.Array.Object} rule.word содержит объект с описаним тегов и регекспа для этого слова
 *     @returns {Object.Array.Object} rule.word[0]["token"] токен для редактора, через точку перечислены все теги
 *     @returns {Object.Array.Object} rule.word[0]["regex"] регексп со словом /word/
 */
function getACEModeRules(words) {
    let rule = {};
    rule.start = [];

    let token,
        regex,
        wordRule;
    
    words.forEach((w) => {
        let word = w.id;
        // rule.start с инклудами правил
        rule.start.push({include: word});
        // название класса CSS
        if (w.hasOwnProperty('posClass')) {
            token = w.posClass;
            token = `MORPH.morph_${token}`;
        }
        else token = 'MORPH.morph_null';
        regex = new RegExp("(?!\\s+)" + word + "(?![\\wа-я-]+)");
        wordRule = [
                {
                    token: token,
                    regex: regex,
                    caseInsensitive: true,
                }
            ]
        rule[word] = wordRule;
    })
    
    return rule;
}

/**
 * создает свойство с классом части речи
 * @param {*} props 
 */
function getLiPOSClass(props) {
    let liPrefix = 'http://www.lexinfo.net/ontology/2.0/lexinfo#';
    let word = props.word;
    let pos = props.content['http://www.lexinfo.net/ontology/2.0/lexinfo#partOfSpeech'];
    let cl = lexInfoPOSClasses[pos];
    cl = (cl) ? cl.replace(liPrefix, '') : null;
    results.addCell({word: word, type: 'posClass', content: cl});
}
