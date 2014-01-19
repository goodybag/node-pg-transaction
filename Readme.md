[![Build Status](https://travis-ci.org/goodybag/node-pg-transaction.png)](https://travis-ci.org/goodybag/node-pg-transaction)
[![Dependency Status](https://gemnasium.com/goodybag/node-pg-transaction.png)](https://gemnasium.com/goodybag/node-pg-transaction)

[![NPM](https://nodei.co/npm/pg-transaction.png)](https://nodei.co/npm/pg-transaction/)

Make it easier to write transactions for PostgreSQL using [node-postgres](https://github.com/brianc/node-postgres).

The callback and event emitter styles both work.  
**Note:** if you use a callback, then the error event won't be emitted. This is consistent with node-postgres.

##Installation:

To install the most recent release from npm, run:

```
npm install pg-transaction
```

## Methods:

```javascript
begin([mode], [callback]);
query(); // This is pg.Client.query from node-postgres. There are various possible arguments look at its documentation
savepoint(savepoint, [callback]);
release(savepoint, [callback]);
rollback([savepoint], [callback]);
commit([callback]);
abort([callback]);
```

## Events:

- error

## Example:

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

client.query("SELECT COUNT(*) AS count FROM beatles", function(err, result){
  if (err) return die(err);
  console.log(result.rows[0].count); // 1
  client.end();
});
```

## Contributors:

- [Lalit Kapoor](https://github.com/lalitkapoor)

### Special thanks to the following:

- [Brian M. Carlson](https://github.com/brianc)
