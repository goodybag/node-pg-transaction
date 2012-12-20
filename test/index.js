
/**
 * Module dependencies
 */

var
  pg = require('pg')
, async = require('async')
, should = require('should')
, Transaction = require('../')
;

var
  connectionStr = process.env['PG_CON'] || ''
;

describe('transaction', function(){
  beforeEach(function(){
    this.client = new pg.Client(connectionStr);
    this.client.connect();
    this.client.query("CREATE TEMP TABLE beatles(name varchar(10), height integer, birthday timestamptz)");
  });

  afterEach(function(){
    this.client.end();
  });

  it('#commit - should exist in the database', function(done){
    var tx = new Transaction(this.client);
    tx.begin();
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
    tx.commit();
    this.client.query("SELECT * FROM beatles", function(err, result){
      if (err) throw err;
      result.rows.should.have.length(2);
      done();
    });
  });

  it('#rollback - should not exist in the database', function(done){
    var tx = new Transaction(this.client);
    tx.begin();
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
    tx.rollback();
    this.client.query("SELECT * FROM beatles WHERE name = $1", ['John'], function(err, result){
      if (err) throw err;
      result.rows.should.have.length(0);
      done();
    });
  });

  it('#savepoint - create a savepoint and rollback to it', function(done){
    var tx = new Transaction(this.client);
    tx.begin();
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
    tx.savepoint('test');
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
    tx.rollback('test');
    tx.commit();
    this.client.query("SELECT * FROM beatles", function(err, result){
      if (err) throw err;
      result.rows.should.have.length(1);
      done();
    });
  });

  it('#release - destroy a savepoint (cannot rollback to it anymore)', function(done){
    var tx = new Transaction(this.client);
    tx.on('error', function(err){
      throw err;
    });

    tx.begin();
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
    tx.savepoint('test');
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
    tx.release('test');
    tx.rollback('test', function(err){
      should.exist(err);
      err.code.should.equal('3B001');
      done();
    });
    tx.commit();
  });

  it('error in transaction', function(done){
    var tx = new Transaction(this.client);

    var successful = true;
    tx.on('error', function(err){
      successful = false;
    });

    tx.begin();
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)]);
    tx.query("INSERT INTO dummy(name, height, birthday) values($1, $2, $3)", ['Bob', 68, new Date(1944, 10, 13)]);
    tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)]);
    tx.commit();
    this.client.query("SELECT * FROM beatles", function(err, result){
      if (err) throw err;
      successful.should.equal(false);
      result.rows.should.have.length(0);
      done();
    });
  });

  it('recover from error in transaction by using a savepoint', function(done){
    var self = this;
    var tx = new Transaction(this.client);

    var checkDone = function(){
      self.client.query("SELECT * FROM beatles", function(err, result){
        if (err) throw err;
        result.rows.should.have.length(2);
        done();
      });
    }

    tx.begin(function(err){
      if (err) throw err;
      tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)], function(err){
        if (err) throw err;
        tx.savepoint('savepoint1', function(err){
          if (err) throw err;
          tx.query("INSERT INTO dummy(name, height, birthday) values($1, $2, $3)", ['Bob', 68, new Date(1944, 10, 13)], function(err){
            if (err) {
              tx.rollback('savepoint1', function(err){
                if (err) throw err;
                tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)], function(err){
                  tx.commit(function(err){
                    if (err) throw err;
                    checkDone();
                  });
                });
              });
            } else {
              tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)], function(err){
                tx.commit(function(err){
                  if (err) throw err;
                  checkDone();
                });
              });
            }
          });
        });
      });
    });
  });

  it('abort a failing transaction', function(done){

    var stage = null;
    var tx = new Transaction(this.client);
    async.series(
      {
        begin: function(callback){
          stage = 'begin';
          tx.begin(callback);
        }
      , i1: function(callback){
          stage = 'i1';
          tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['Ringo', 67, new Date(1945, 11, 2)], callback);
        }
      , i2: function(callback){
          stage = 'i2';
          tx.query("INSERT INTO dummy(name, height, birthday) values($1, $2, $3)", ['Bob', 68, new Date(1944, 10, 13)], callback);
        }
      , i3: function(callback){
          stage = 'i3';
          tx.query("INSERT INTO beatles(name, height, birthday) values($1, $2, $3)", ['John', 68, new Date(1944, 10, 13)], callback);
        }
      , commit: function(callback){
          stage = 'commit';
          tx.commit(function(err){
            if (err) return callback(err);
            done();
          });
        }
      }
    , function(err, results){
        if('i2' === stage) should.exist(err);
        if (err) return tx.abort(function(err){
          if (err) throw err;
          done();
        });
      }
    );
  });
});