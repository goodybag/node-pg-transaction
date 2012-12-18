[![Build Status](https://travis-ci.org/goodybag/node-pg-transaction.png)](https://travis-ci.org/goodybag/node-pg-transaction)

Make it easier to write transactions for PostgreSQL using node-postgres.

```javascript

/**
 * Module dependencies
 */

var
  // PostgreSQL modules
  pg = require('pg')
, Transaction = require('pg-transaction')

  // Configuration stuff
, connectionString = process.env['PG_CON'] || ''
;

var die = function(err){
  if (err) throw err;
};

var client = new pg.Client(connectionString);
client.connect();

client.query("CREATE TEMP TABLE beatles(name varchar(10), height integer, birthday timestamptz)");

var tx = new Transaction(client);
tx.on('error', die);

tx.begin();
tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
tx.savepoint('savepoint1');
tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
tx.rollback('savepoint1'); // all statements after savepoint1 are undone (John will not be inserted)
tx.release('savepoint1'); // can no longer use savepoint1 as a point to rollback to
tx.commit();

client.query("SELECT COUNT(*) as count FROM beatles", function(err, result){
  if (err) return die(err);
  console.log(result.rows[0].count); // 1
  client.end(); // close connection
});
```