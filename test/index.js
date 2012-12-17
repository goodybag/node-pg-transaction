
/**
 * Module dependencies
 */

var
  pg = require('pg')
, should = require('should')
, Transaction = require('../');
;

var
  connectionStr = 'tcp://localhost:5432'
, client = null
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
  });
});