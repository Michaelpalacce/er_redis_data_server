'use strict';

const DataServer				= require( 'event_request/server/components/caching/data_server' );
const redis						= require( 'redis' );

const MAX_TTL					= 2147483647;
const DEFAULT_TTL				= 300;
const PREFIX					= '#$OBJ$#';

/**
 * @brief	Data server that stores data in a local or remote redis instance
 */
class RedisDataServer extends DataServer
{
	/**
	 * @param	{Object} options
	 */
	_configure( options )
	{
		this.clientSettings		= typeof options.clientSettings === 'object'
								? options.clientSettings
								: {};

		this.defaultTtl			= typeof options.ttl === 'number'
								? options.ttl
								: DEFAULT_TTL;

		this.defaultTtl			= this.defaultTtl === -1 ? MAX_TTL : this.defaultTtl;

		this.server				= redis.createClient( this.clientSettings );
	}

	/**
	 * @copydoc	DataServer::_stop()
	 */
	_stop()
	{
		this.server.end( true );
	}

	/**
	 * @copydoc	DataServer::_get()
	 */
	_get( key, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.get( key, ( err, response ) => {
				/* istanbul ignore next */
				if ( err )
					reject( err );

				if ( typeof response === 'string' && response.indexOf( PREFIX ) !== -1 )
					response	= JSON.parse( response.slice( PREFIX.length ) );

				resolve( response );
			});
		});
	}

	/**
	 * @copydoc	DataServer::_set()
	 */
	async _set( key, value, ttl, options )
	{
		let valueToSet	= value;

		if ( typeof value === 'object' )
			valueToSet	= PREFIX + JSON.stringify( value );

		return new Promise(( resolve, reject ) => {
			this.server.set( key, valueToSet, 'EX', this._getTtl( ttl ), ( error ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( value );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_delete()
	 */
	async _delete( key, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.del( key, ( error, response ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( true );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_increment()
	 */
	async _increment( key, value, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.incrby( key, value, ( error, result ) => {
					if ( error )
						resolve( null );

					if ( result === undefined )
						resolve( null );

					resolve( result );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_decrement()
	 */
	async _decrement( key, value, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.decrby( key, value, ( error, result ) => {
				if ( error )
					resolve( null );

				if ( result === undefined )
					resolve( null );

				resolve( result );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_touch()
	 */
	async _touch( key, ttl, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.expire( key, this._getTtl( ttl ), ( error, result ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( result === 1 );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_lock()
	 */
	async _lock( key, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.setnx( key, DataServer.LOCK_VALUE, ( error, result ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( result === 1 );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_lock()
	 */
	async _unlock( key, options )
	{
		return await this._delete( key, options );
	}

	/**
	 * @copydoc	DataServer::_getTtl()
	 */
	_getTtl( ttl = -1 )
	{
		ttl	= super._getTtl( ttl );

		if ( ttl === Infinity || ttl > MAX_TTL )
			ttl	= MAX_TTL;

		return ttl;
	}
}

module.exports	= RedisDataServer;