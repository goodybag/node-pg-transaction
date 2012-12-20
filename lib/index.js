
/**
 * Module dependencies
 */

var
  pgClient = require('pg').Client
, EventEmitter = require('events').EventEmitter
, util = require('util')
;

var Transaction = module.exports = function(client) {
  this.client = client;
};

util.inherits(Transaction, EventEmitter);

/**
 * Execute a query, re-emit the events that the client is receiving from this
 * EventEmitter
 */
Transaction.prototype.query = function(){
  var self = this;
  var query = pgClient.prototype.query.apply(this.client, arguments);

  query.on('row', function(row, result){
    self.emit('row', row, result);
  });

  query.on('end', function(result){
    self.emit('end', result);
  });

  query.on('error', function(err){
    self.emit('error', err);
  });
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
 * @param  {String}   savepoint name of the savepoint
 * @param  {Function} callback
 */
Transaction.prototype.savepoint = function(savepoint, callback) {
  this.query('SAVEPOINT ' + savepoint, callback);
};

/**
 * Destroy a previously defined savepoint
 * @param  {String}   savepoint name of the savepoint
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
 * @param  {String}   savepoint [optional] name of the savepoint to rollback to
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