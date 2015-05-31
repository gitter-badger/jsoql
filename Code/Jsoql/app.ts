﻿
import eng = require('./Scripts/engine')
import http = require('http');
import fs = require('fs')
import m = require('./Scripts/models')
import yargs = require('yargs')


var argv = yargs
    .usage('jsoql [command] [options]')
    .command('query', 'execute a query and output the results as JSON', cmdArgs => {
        argv = cmdArgs
            .option('q', {
                alias: 'query',
                required: true,
                description: 'JSOQL query to be executed',
                type: 'string'
            })
            .option('o', {
                alias: 'output',
                required: false,
                description: 'Output file (optional)',
                type: 'string'
            })
            .option('i', {
                alias: 'indent',
                required: false,
                description: 'Indent the JSON output',
                type: 'boolean'
            })
            .help('help')
            .argv;

        DoQueryCommand(argv);
    })
    .help('help')
    .argv;

console.log(argv);

function DoQueryCommand(argv: yargs.Argv) {

    var query = argv['query'];

    var engine = new eng.DesktopJsoqlEngine();
    //var engine = new eng.OnlineJsoqlEngine();

    var context: m.QueryContext = {
        BaseDirectory: process.cwd(),
        Data: {
            "Test": [
                { Name: 'Dave', FavouriteFood: 'Chips' },
                { Name: 'Jim', FavouriteFood: 'Baked beans' }
            ]
        }
    };

    engine.ExecuteQuery(query, context)
        .then(results => {
            if (results.Errors && results.Errors.length) {
                var message = '\nError encountered while executing query.';
                message += `\n\nQuery: ${query } \n\nError: ${results.Errors[0]}\n`;
                process.stderr.write(message);
            }
            else {
                var indent = argv['indent'] ? 4 : null;
                process.stdout.write(JSON.stringify(results.Results, null, indent));
            }
        })
        .fail(error => console.log(error));
}


//Local http server for testing purposes

    //if (args['w']) {
    //    var data = [
    //        { Value: 1 },
    //        { Value: 2 }
    //    ];

    //    var server = http.createServer((req, res) => {
    //        res.write(JSON.stringify(data));
    //        res.end();
    //    });

    //    server.listen(parseInt(args['w']));

    //    process.on('exit',() => {
    //        server.close();
    //    });
    //}

//Help mode for testing purposes
   ////In "query help" mode, treat '@' as placeholder for cursor and get properties in scope at cursor
    //if (args['h']) {
    //    var cursor = query.indexOf('@');
    //    if (cursor < 0) throw new Error('Query must contain cursor placeholder @ in help mode');
    //    query = query.replace('@', '');


    //    engine.GetQueryHelp(query, cursor, context)
    //        .then(help => console.log(help))
    //        .fail(error => console.log(error));

    //} else {