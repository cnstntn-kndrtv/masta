var ldf = require('ldf-client');
var N3 = require('N3');
var fs = require('fs');
let fileName = './public/js/lexinfo-tags-description.js'; 

ldf.Logger.setLevel('error');

var fragmentsClient = new ldf.FragmentsClient('http://localhost:3001/lexinfo');

let q = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#>
 
SELECT ?prop ?propLabel ?propComment ?ind ?indLabel ?indComment
WHERE {
    {
        ?prop rdfs:subPropertyOf lexinfo:morphosyntacticProperty ;
                rdfs:label ?propLabel ;
                rdfs:comment ?propComment .
    }
    UNION
    {
        ?prop rdfs:range ?rangeClass .
        ?ind a ?rangeClass ;
                rdfs:label ?indLabel ;
                rdfs:comment ?indComment .
    }
    FILTER( LANG(?propLabel) = "" || LANG(?propLabel) = "en")
    FILTER( LANG(?propComment) = "" || LANG(?propComment) = "en")
    FILTER( LANG(?indLabel) = "" || LANG(?indLabel) = "en")
    FILTER( LANG(?indComment) = "" || LANG(?indComment) = "en")
}`;

let results = new ldf.SparqlIterator(q, { fragmentsClient: fragmentsClient });
let n = 0;
let tags = {};

function getLiteral(l) {
    return (l) ? N3.Util.getLiteralValue(l) : null;
}

results.on('data', (result) => {
    let prop = result['?prop'],
        propLabel = getLiteral(result['?propLabel']),
        propComment = getLiteral(result['?propComment']),
        ind = result['?ind'],
        indLabel = getLiteral(result['?indLabel']),
        indComment = getLiteral(result['?indComment']);
    if (propLabel) {
        tags[prop] = tags[prop] || {};
        tags[prop].label = propLabel;
        tags[prop].comment = (tags[prop].comment) ? tags[prop].comment += ' ' + propComment : propComment;
    } else if (ind) {
        tags[ind] = tags[ind] || {};
        tags[ind].label = indLabel;
        tags[ind].comment = (tags[ind].comment) ? tags[ind].comment += ' ' + indComment : indComment;
    }
});

results.on('end', () => {
    fs.exists(fileName, (exist) => {
        if (exist) {
            fs.unlinkSync(fileName);
        }
        let content = 'var lexInfoTagsDescription = ' + JSON.stringify(tags);
        fs.appendFile(fileName, content, (error) => {
            if(error) console.log(error);
            else console.log('done');
        });
    })
    
});


// properties individuals
// lexinfo:animacy lexinfo:animate