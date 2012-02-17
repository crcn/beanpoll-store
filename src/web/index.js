var store = require('./store'),
logger = require('mesh-winston').loggers.get('store.core')

exports.plugin = function(router)
{

	var channelsKey = 'stored/channels3';

	var storedChannels = store.get(channelsKey) || {};

	function getData(channel)
	{
		var d = store.get(channel);




		logger.verbose('get data');

		//model? deserialize it.
		if(d.name && getModel(d.name))
		{
			logger.verbose('set model');
			var clazz = getModel(d.name);
			var md = new clazz();

			if(md._set) md._set(d.data);

			return md;
		}
		else
		{
			return d.data;
		}
	}


	function listenOnPull(channel)
	{
		try
		{ 
			router.on(channel, { type: 'pull' }, function()
			{
				return getData(channel);
			});
		}

		//error thrown IF it already exists...
		catch(e)
		{

		}
	}


	function getModel(name) {
		return router.models ? router.models[name] : null;
	}




	router.on({

		/**
		 */

		'pull store/:key OR store': function(req, res) {

			var key = this.data('key'),
			data = req.sanitized[key] = getData(key);

			if(!this.next()) res.end(data);
		},

		/**
		 */


		'push store': function(ops)
		{
			logger.verbose('store data: ' + ops.channel);

			var toStore = null;

			if(ops.data)
			{

				//is it a model? serialize it.
				if(ops.data._bindings && ops.data.doc)
				{
					logger.verbose('is a model');

					toStore = { name: ops.data.name, data: ops.data.doc };
				}
				else
				{
					toStore = { data: ops.data };
				}

				storedChannels[ops.channel] = 1;

				//data exists? listen on pull since it's cached
				listenOnPull(ops.channel);
			}

			//otherwise delete the store channel so we don't listen for it on startup
			else
			{
				delete storedChannels[ops.channel];
			}

			store.set(channelsKey, storedChannels);


			//cache the data now.
			store.set(ops.channel, toStore);

			//PUSH the data out now
			router.request(ops.channel).query(ops.data).push();
		},


		/**
		 */

		'pull load/*': function()
		{
			logger.verbose('store ready');

			for(var channel in storedChannels)
			{
				listenOnPull(channel);

				router.push(channel, getData(channel));
			}	
			logger.verbose('done pushing data');

			this.next();

		}
	});

}