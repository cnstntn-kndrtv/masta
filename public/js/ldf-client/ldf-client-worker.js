// import ldf-client
var window = self;
importScripts('ldf-client-browser.js');

ldf.Logger.setLevel('error');

let workerId = Math.ceil(Math.random() * 100) + '-' + Math.ceil(Math.random() * 100);
// console.log('--WORKER SATRTED--', workerId);

let clientCounter = 0;
let clients = [];

class Client {
    constructor() {
        this._logger = new ldf.Logger();
        this._logger._print = (item) => {
            postMessage({ type: 'log', log: items.slice(2).join(' ').trim() + '\n' });
        }
        this._results = [];
        this._clientNumber = ++clientCounter;
    }

    query(config) {
        this._config = config;
        this._config.logger = this._logger;
        
        this._id = this._config.query.id;
        // console.log('query. workerId:', workerId, 'client #', this._clientNumber, 'num of clients', clientCounter, 'this Id', this._id);

        try { this._fragmentsClient = new ldf.FragmentsClient(this._config.datasource, this._config) }
        catch (error) {
            error.id = this._id;
            postMessage({ type: 'error', error: error });
            this.stop();
        }
        
        try { this._resultsIterator = new ldf.SparqlIterator(this._config.query.query, { fragmentsClient: this._fragmentsClient }); }
        catch (error) { 
            error.id = this._id;
            postMessage({ type: 'error', error: error});
            this.stop();
        }

        if (this._resultsIterator) {
            this._resultsIterator.on('data', (result) => {
                this._results.push(result);
            });

            this._resultsIterator.on('end', () => { 
                // console.log('flush resullts. workerId:', workerId, 'client #', this._clientNumber, 'num of clients', clientCounter, 'this Id', this._id);
                postMessage( { type: 'result', result: { data: this._results, id: this._id } } );
                this.stop();
            });

            this._resultsIterator.on('error', (error) => {
                error = { 
                    message: error.message || error.toString(),
                    id: this._id,
                };
                postMessage({ type: 'error', error: error });
                this.stop();
            });
        }
        
    }

    stop() {
        if (this._resultsIterator) {
            this._resultsIterator.removeAllListeners();
            this._resultsIterator = null;
        }
        if (this._fragmentsClient) {
            this._fragmentsClient.abortAll();
            this._fragmentsClient = null;
        }
        --clientCounter;
        // console.log('stop client. workerId:', workerId, 'client #', this._clientNumber, 'num of clients', clientCounter, 'this Id', this._id);
        // если все клиенты завершены - закрывается воркер
        if (clientCounter == 0) {
            postMessage({type: 'bye'});
            // console.log('Worker closed', workerId);
            close();
        }
    }

}

let handlers = {
    query: (messageData) => {
        let data = messageData.data;

        data.queries.forEach((query) => {
            config = {
                datasource: data.datasource,
                query: query
            }
            let client = new Client();
            client.query(config);
            clients.push(client);
        });
    },

    // принудительная остановка
    destroy: () => {
        clients.forEach((client) => client.stop());
    }
}


self.onmessage = (m) => { handlers[m.data.type](m.data); };