var ldf = require('ldf-client');
var N3 = require('N3');
var fs = require('fs');
let fileName = './public/js/lexinfo-pos-classes.js'; 

ldf.Logger.setLevel('error');

var fragmentsClient = new ldf.FragmentsClient('http://localhost:3001/lexinfo');

let q = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#>
 
SELECT ?posClass ?pos
WHERE {
    {
        ?posClass rdfs:subClassOf lexinfo:PartOfSpeech .
        ?pos rdf:type ?posClass .
    }
}`;

let results = new ldf.SparqlIterator(q, { fragmentsClient: fragmentsClient });
let n = 0;
let tags = {};

function getLiteral(l) {
    return (l) ? N3.Util.getLiteralValue(l) : null;
}

results.on('data', (result) => {
    let pos = result['?pos'];
    let cls = result['?posClass']
    tags[pos] = cls;
});

results.on('end', () => {
    fs.exists(fileName, (exist) => {
        if (exist) {
            fs.unlinkSync(fileName);
        }
        let content = 'var lexInfoPOSClasses = ' + JSON.stringify(tags);
        fs.appendFile(fileName, content, (error) => {
            if(error) console.log(error);
            else console.log('done');
        });
    })
    
    let set = new Set();
    let liPrefix = 'http://www.lexinfo.net/ontology/2.0/lexinfo#';
    for (let key in tags) {
        if (tags.hasOwnProperty(key)) {
            let el = tags[key].replace(liPrefix, '');
            set.add(el);
        }
    }
    console.log(set);
});