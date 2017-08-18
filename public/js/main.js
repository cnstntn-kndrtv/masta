/**
 * Инициализация и запуск редктора ACE в #editor-container
 */
var demoTxt = 'Выставка "Человек как птица. Образы путешествий" исследует вопросы новых открытий на стыке оптики и искусства, в тех сферах, которые объединены стремлением человека к познанию мира и определению своего места в нем.';
// demoTxt = 'как'
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
    // let refreshmodechechbox = document.getElementById("refreshmode");
    // nlpsession.on("change", function(){
    //     if(refreshmodechechbox.checked) getTextInfo();
    // });

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
            // if (e.id) console.log('Error', e);
            ++errorCounter;
            let res = (e.id) ? {id: e.id, error: true} : [];
            this._addResults(res);
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
    constructor (tailHeaders, firstHeader) {
        super();
        this._db = [];
        this._tailHeaders = tailHeaders || ['Морфология', 'Лемма', 'Произношение'];
        this._firstHeader = firstHeader || 'Слово';
        this._headers = [];
        this._headers.push(this._firstHeader);
        this._headers = this._headers.concat(this._tailHeaders);
        
    }

    clear() {
        this._db = [];
        this.emit('clear');
    }

    addWords(words) {
        words.forEach((word) => {
            let record = {};
            let emptyHypothese = {};
            this._headers.forEach((key) => {
                if (key == this._firstHeader) {
                    record[key] = word;
                    record['id'] = word;
                }
                else emptyHypothese[key] = 'loading';
            })
            record.hypotheses = [];
            this._db.push(record);
        });
        this.emit('addWords');
    }

    addHypothesis(props) {
        for(let i = 0, l = this._db.length; i < l; i++) {
            if (this._db[i].id == props.word) {
                this._db[i].hypotheses.push(props.content);
                this.emit('addHypothesis');
                if (props.content.posClass) updateACEMode(this._db);
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
        this._firstHeader = this._res._firstHeader;
        this._tailHeaders = this._res._tailHeaders;
        this._container = container;
        this._firstHeaderWidth = '15'; // %
        this._tailHeaderWidth = 100 / this._tailHeaders.length;
        this._createTable();

        this._res.on('addWords', () => this._createTableBody());
        this._res.on('addHypothesis', (props) => this._updateHypotheses());
    }
    
    _createTable() {
        this._table = document.querySelector(this._container);
        let div = document.createElement('div');
        div.setAttribute('class', 'table-responsive');
        let table = document.createElement('table');
        table.setAttribute('class', 'table table-hover table-condensed');
        
        this._thead = document.createElement('thead');
        this._tbody = document.createElement('tbody');
        let theadTr = document.createElement('tr');

        this._headers.forEach((header) => {
            let th = document.createElement('th');
            let width = (header == this._firstHeader) ? this._firstHeaderWidth : this._tailHeaderWidth;
            th.setAttribute('width', width + '%');
            th.innerText = header;
            theadTr.appendChild(th);
        });

        this._thead.appendChild(theadTr);
        table.appendChild(this._thead);
        table.appendChild(this._tbody);
        div.appendChild(table);
        this._table.appendChild(div);
    }

    _getLoader(str) {
        if (str == 'loading') return 'loader';
        else return '';
    }

    _getCellContent(data) {
        let span = document.createElement('span')
        if (typeof(data) == 'object') {
            span = data;
        }
        else if (data == 'loading') span.innerText = '';
        else if (data == 'error') span.innerText = '☠️';
        else if (!data) span.innerText = '🛠';
        else span.innerText = data;
        return span.outerHTML;
    }

    _createTableBody() {
        this._tbody.innerHTML = '';
        this._res._db.forEach((record) => {
            let tr = document.createElement('tr');
            let wordTd = document.createElement('td');
            wordTd.setAttribute('width', this._firstHeaderWidth + '%');
            wordTd.innerText = record[this._firstHeader];
            let hypothesesTd = document.createElement('td');
            hypothesesTd.setAttribute('class', 'hypotheses-table');
            hypothesesTd.setAttribute('colspan', this._headers.length - 1);
            let hypothesTable = document.createElement('table');
            hypothesTable.setAttribute('class', 'table table-hover table-condensed');
            let hypothesTbody = document.createElement('tbody');
            let hypothesesRow = document.createElement('tr');
            let hypothesesDiv = document.createElement('div');
            hypothesesDiv.setAttribute('class', 'loader');
            
            hypothesesRow.appendChild(hypothesesDiv);
            hypothesTbody.appendChild(hypothesesRow);
            hypothesTable.appendChild(hypothesTbody);
            hypothesesTd.appendChild(hypothesTable);
            tr.appendChild(wordTd);
            tr.appendChild(hypothesesTd);
            this._tbody.appendChild(tr);

            record.element = {
                hypotheses: hypothesTbody,
                word: wordTd,
            }
        })
    }

    _updateHypotheses() {
        this._res._db.forEach((record) => {
            let posClass = (record.hypotheses[0]) ? 'ace_morph_' + record.hypotheses[0].posClass : '';
            record.element.word.setAttribute('class', posClass);

            let hypoTbody = record.element.hypotheses;
            hypoTbody.innerHTML = '';
            record.hypotheses.forEach((hypo) => {
                let tr = document.createElement('tr');
                this._tailHeaders.forEach((header) => {
                    let td = document.createElement('td');
                    td.setAttribute('width', this._tailHeaderWidth + '%');
                    let div = document.createElement('div');
                    let content = hypo[header];
                    div.setAttribute('class', this._getLoader(content));
                    div.innerHTML = this._getCellContent(content);
                    td.appendChild(div);
                    tr.appendChild(td);
                })
                hypoTbody.appendChild(tr);
            })
        });
    }

}

/**
 * максимальное количество воркеров
 */
let maxWorkers = navigator.hardwareConcurrency || 2;

/**
 * доступное количество воркеров
 */
let availableWorkers = maxWorkers;

// console.time
var workerCounter = 0, errorCounter = 0;

let tailHeaders = ['ЧР', 'Морфология', 'Лемма', 'Произношение'];
let firstHeader = 'Слово';
let results = new Results(tailHeaders, firstHeader);
let table = new ResultsTable(results, '#words-container');

function getTextInfo() {
    let tokenTypes = ["WORD.CYRIL"];
    let tokens = Az.Tokens(nlpsession.getDocument().getValue()).done(tokenTypes);
    let words = new Set;
    if (tokens.length != 0 ) {
        tokens.forEach((t) => {
            words.add(t.toString().toLowerCase());
        });
        startRequest(Array.from(words));
    }
}

function startRequest(word) {
    let queries = [];
    let words;
    if (typeof(word) == 'string') {
        words = [];
        words.push(word);
    }
    else words = word;
    console.time('query');
    let maxQueriesInEachWorker = Math.ceil(words.length / maxWorkers);
    results.clear();
    results.addWords(words);
    for (let i = 0, l = words.length, word = ''; i < l; i++) {
        word = words[i];
        queries.push({
            id: word,
            query: 'PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#> \
                    PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> \
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \
                    SELECT DISTINCT ?wordId ?formId ?lemmaId ?formP ?formO ?lemmaWr ?lemmaP ?lemmaO ?phoneticRep \
                    WHERE { \
                        ?formId ontolex:writtenRep "' + word + '"@ru . \
                        ?formId ?formP ?formO . \
                        \
                        ?wordId ontolex:otherForm ?formId ; \
                                ontolex:canonicalForm ?lemmaId . \
                        \
                        ?lemmaId ontolex:writtenRep ?lemmaWr . \
                        ?lemmaId ?lemmaP ?lemmaO . \
                        \
                        OPTIONAL { \
                            ?formId ontolex:phoneticRep ?phoneticRep . \
                        } \
                        \
                        FILTER( REGEX( STR(?formP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                        FILTER( REGEX( STR(?lemmaP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) \
                    }',
        });
        if (queries.length == maxQueriesInEachWorker) {
            executeRequests(queries);
            queries = [];
        } else if (i+1 == l) executeRequests(queries);
    }
}

function executeRequests(queries) {
    let params = {
        datasource: 'http://ldf.kloud.one/ontorugrammaform',
        queries: queries,
    }
    console.log(params);
    let w = new QueryWorker(params);
    
    ++workerCounter;
    
    w.start();
    w.on('data', (res) => {
        // если нет данных, или ошибка
        if (res.id == 'как') console.log(res);
        if (!res.data || res.data.length == 0) {
            if (res != 0) {
                // для таблицы результатов
                // если ошибка, то сообщение об ошибки, иначе - сообщение что нет значения.
                let value = 'error';
                results.addHypothesis({
                        word: res.id,
                        content: {
                            'Лемма': value,
                            'ЧР': value,
                            'Морфология': value,
                            'Ссылка': value,
                            'Произношение': value,
                            'posClass': value,
                        }
                    });
            }
        }
        // данные есть
        else {
            let words = {};
            /*
            results = {
                formId: {
                    morph: {
                        formP(lemmaP): formO(lemmaO),
                    },
                    lemmaWr: '',
                    phoneticRep: '',
                    wordId: ''
                }
            }
            */
            res.data.forEach((r) => {
                let wordId = r['?formId'];
                if (!words.hasOwnProperty(wordId)) words[wordId] = {};
                let w = words[wordId];
                if(!w.hasOwnProperty('morph')) w.morph = {};
                let m = w.morph;

                let formO = r['?formO'],
                    formP = r['?formP'],
                    lemmaO = r['?lemmaO'],
                    lemmaP = r['?lemmaP'];
                
                if (formP && formO) {
                    m[formP] = formO;
                }
                if (lemmaP && lemmaO) {
                    m[lemmaP] = lemmaO;
                }

                if (r['?lemmaWr'] && !w.hasOwnProperty('lemmaWr')) {
                    let lemmaWr = getLiteral(r['?lemmaWr']);
                    w.lemmaWr = lemmaWr;
                }
                if (r['?phoneticRep'] && !w.hasOwnProperty('phoneticRep')) {
                    let phoneticRep = getLiteral(r['?phoneticRep']);
                    w.phoneticRep = phoneticRep;
                }
                if (r['?wordId'] && !w.hasOwnProperty('wordId')) {
                    w.wordId = r['?wordId'];
                }
            });
            for (let formId in words) {
                if (words.hasOwnProperty(formId)) {
                    let el = words[formId];
                    let posClass = getLiPOSClass(el.morph);
                    results.addHypothesis({
                        word: res.id,
                        content: {
                            'Лемма': el.lemmaWr || undefined,
                            'Произношение': el.phoneticRep || undefined,
                            'ЧР': posClass,
                            'Морфология': lexInfoTagsToString(el.morph),
                            'Ссылка': formId,
                            'posClass': posClass,
                        }
                    });
                }
            }
        }
    });
    
    w.on('bye', () => {
        --workerCounter;
        console.log('running workers count', workerCounter);
        if (workerCounter == 0) {
            console.timeEnd('query');
            console.log('errors count', errorCounter);
        }
    });
}

function lexInfoTagsToString(tags) {
    let span = document.createElement('span');
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
            let li = document.createElement('span');
            li.setAttribute('class', 'morpho-tags');
            li.setAttribute('style', "cursor: pointer");
            li.setAttribute('tooltipContent', comment);
            li.setAttribute('onmouseover', 'showTooltip(this)')
            li.innerText ='[' + label + ']' + lineEnd;
            span.appendChild(li);
        }
    }
    return span;
}

function showTooltip(element) {
    new Tooltip(element, {
        placement: 'top',
        title: element.attributes.tooltipContent.value
    });
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
        let token = (w.hypotheses[0]) ? w.hypotheses[0].posClass : null;
        if (token) {
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
 * возвращает часть речи
 * @param {*} morph 
 */
function getLiPOSClass(morph) {
    let liPrefix = 'http://www.lexinfo.net/ontology/2.0/lexinfo#';
    let liPOSURI = 'http://www.lexinfo.net/ontology/2.0/lexinfo#partOfSpeech';
    let pos = (morph.hasOwnProperty(liPOSURI)) ? morph[liPOSURI] : undefined;
    let cl = lexInfoPOSClasses[pos];
    cl = (cl) ? cl.replace(liPrefix, '') : undefined;
    return cl;
}

/**
 * возвращает литерал текстовой строки rdf
 */
function getLiteral(l) {
    let match = /^"([^]*)"/.exec(l);
    return (match) ? match[1] : null;
}
