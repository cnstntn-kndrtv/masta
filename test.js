var ldf = require('ldf-client');
ldf.Logger.setLevel('error');
// require ('./public/js/lexinfo-labels.js');
// console.log(lexInfoTagsDescription);

var fragmentsClient = new ldf.FragmentsClient('http://ldf.kloud.one/ontorugrammaform');

let word = 'как';

let query = 
`PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#>
PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
# SELECT ?wordId ?formId ?lemmaId ?formP ?formO ?lemmaWr ?lemmaP ?lemmaO ?phoneticRep
SELECT DISTINCT *
WHERE {
    ?formId ontolex:writtenRep "${word}"@ru ;
            ?formP ?formO .
    
   ?wordId ontolex:otherForm ?formId ;
           ontolex:canonicalForm ?lemmaId .
   
   ?lemmaId ontolex:writtenRep ?lemmaWr .
   ?lemmaId ?lemmaP ?lemmaO . 
   
    OPTIONAL {
        ?formId ontolex:phoneticRep ?phoneticRep .
    }
}`;


let results = new ldf.SparqlIterator(query, { fragmentsClient: fragmentsClient });

let allResults = [];

results.on('data', (result) => { 
    // console.log(result); console.log('') 
    allResults.push(result);
});

results.on('error', (e) => {
    console.log('Error!', e);
})

results.on('end', () => {
    console.log('---END---')
    console.log(allResults);
})


// PREFIX ontolex: <http://www.w3.org/ns/lemon/ontolex#> PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT DISTINCT ?liFormP ?liFormO ?lemmaWr ?liLemmaP ?liLemmaO WHERE { ?form ontolex:writtenRep "ваннами"@ru . { ?form ?liFormP ?liFormO . FILTER( REGEX( STR(?liFormP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) } UNION { ?word ontolex:otherForm ?form ; ontolex:canonicalForm ?lemmaID . OPTIONAL { ?lemmaID ontolex:writtenRep ?lemmaWr . ?lemmaID ?liLemmaP ?liLemmaO . FILTER( REGEX( STR(?liLemmaP), "http://www.lexinfo.net/ontology/2.0/lexinfo" ) ) } } }