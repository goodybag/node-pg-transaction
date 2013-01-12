
/**
 * Module dependencies
 */

var
  pgClient = require('pg').Client
, EventEmitter = require('events').EventEmitter
, util = require('util')
;

/**
 * Module variables
 */
var
  noop = function(){}
;

/**
 * Create a new transaction object and run any queries in a transaction if provided
 * @param  {Object}                 client      an instance of pgClient
 * @param  {String|Array|Object}  [queries]   a single query string, or a single query object, or an array of query strings or query objects
 * @param  {Function}               [callback]  a callback function when an error occurs or once the transaction has completed
 */
var Transaction = module.exports = function(client, queries, callback) {
  var self = this;
  this.client = client;
  if (queries) {
    // if the queries parameter is a single string or object place it into an array so that async.forEachSeries can iterate through it
    if ((typeof(queries) === 'string') || (typeof(queries) === 'object' && !(queries instanceof Array))) queries = [queries];

    if (callback == null) callback = noop;

    this.begin(function(err){
      if (err) return callback(err);
      async.forEachSeries(
        queries
      , function(query, cb){
          self.query(query, function(err, result){
            cb(err);
          });
        }
      , function(err, results){
          if(err) self.rollback(); return callback(err);
          self.commit(callback);
        }
      );
    });
  }
};

/**
 * Execute a list of queries within a transaction
 * @param  {Object}                 client      an instance of pgClient
 * @param  {String|Array|Object}  [queries]   a single query string, or a single query object, or an array of query strings or query objects
 * @param  {Function}               [callback]  a callback function when an error occurs or once the transaction has completed
 */
Transaction.queries = function(client, queries, callback){
  new Transaction(client, queries, callback);
};

// var Transaction = module.exports = function(client, queries, callback) {
//   this.client = client;
// };

util.inherits(Transaction, EventEmitter);

/**
 * Execute a query, re-emit the events that the client is receiving from this
 * EventEmitter
 */
Transaction.prototype.query = function(){
  var self = this;
  var query = pgClient.prototype.query.apply(this.client, arguments);

  var callback = query.callback;

  if(callback == null){
    query.on('error', function(err){
      self.emit('error', err);
    });
  }
  return query;
};

/**
 * Start a transaction block
 * @param  {Function} callback
 */
Transaction.prototype.begin = function(callback){
  this.client.pauseDrain();
  this.query('BEGIN', callback);
};

/**
 * Define a new savepoint within the current transaction
 * @param  {String}   savepoint     name of the savepoint
 * @param  {Function} callback
 */
Transaction.prototype.savepoint = function(savepoint, callback) {
  this.query('SAVEPOINT ' + savepoint, callback);
};

/**
 * Destroy a previously defined savepoint
 * @param  {String}   savepoint     name of the savepoint
 * @param  {Function} callback
 */
Transaction.prototype.release = function(savepoint, callback) {
  this.query('RELEASE SAVEPOINT ' + savepoint, callback);
};

/**
 * Commit the current transaction
 * @param  {Function} callback
 */
Transaction.prototype.commit = function(callback){
  var self = this;

  this.query('COMMIT', function(err){
    self.client.resumeDrain();
    if (callback) return callback(err);
    if (err) return self.emit('error', err);
  });
};

/**
 * Abort the current transaction or rollback to a previous savepoint
 * @param  {String}   [savepoint]   name of the savepoint to rollback to
 * @param  {Function} callback
 */
Transaction.prototype.rollback = function(savepoint, callback){
  var self = this;

  if(typeof(savepoint) === 'function'){
    savepoint = null;
    callback = savepoint;
  }

  var query = (savepoint != null) ? 'ROLLBACK TO SAVEPOINT ' + savepoint : 'ROLLBACK';

  this.query(query, function(err){
    if (savepoint == null) self.client.resumeDrain();
    if (callback) return callback(err);
    if (err) return self.emit('error', err);
  });
};

/**
 * Abort the current transaction
 * @param  {Function} callback
 */
Transaction.prototype.abort = function(callback) {
  var self = this;

  this.query('ABORT TRANSACTION', function(err){
    self.client.resumeDrain();
    if (callback) return callback(err);
    if (err) return self.emit('error', err);
  });
};
