const file = {
	"actions": {
		"compute-distances": {
			"inputId": "btl-departures-arrivals-airports",
			"metadata": {
				"feed": "compute"
			},
			"outputId": "btl-distances",
			"transformers": [
				{
					"className": "com.sample.ComputeDistanceTransformer",
					"type": "ScalaClassDfTransformer"
				}
			],
			"type": "CopyAction"
		},
		"download-airports": {
			"inputId": "ext-airports",
			"metadata": {
				"feed": "download"
			},
			"outputId": "stg-airports",
			"type": "FileTransferAction"
		},
		"download-departures": {
			"inputId": "ext-departures",
			"metadata": {
				"feed": "download"
			},
			"outputId": "stg-departures",
			"type": "FileTransferAction"
		},
		"join-departures-airports": {
			"inputIds": [
				"stg-departures",
				"int-airports"
			],
			"metadata": {
				"feed": "compute"
			},
			"outputIds": [
				"btl-departures-arrivals-airports"
			],
			"transformers": [
				{
					"code": {
						"btl-connected-airports": "select stg_departures.estdepartureairport, stg_departures.estarrivalairport,\r\n        airports.*\r\n         from stg_departures join int_airports airports on stg_departures.estArrivalAirport = airports.ident"
					},
					"type": "SQLDfsTransformer"
				},
				{
					"code": {
						"btl-departures-arrivals-airports": "select btl_connected_airports.estdepartureairport, btl_connected_airports.estarrivalairport,\r\n        btl_connected_airports.name as arr_name, btl_connected_airports.latitude_deg as arr_latitude_deg, btl_connected_airports.longitude_deg as arr_longitude_deg,\r\n        airports.name as dep_name, airports.latitude_deg as dep_latitude_deg, airports.longitude_deg as dep_longitude_deg\r\n           from btl_connected_airports join int_airports airports on btl_connected_airports.estdepartureairport = airports.ident"
					},
					"type": "SQLDfsTransformer"
				}
			],
			"type": "CustomSparkAction"
		},
		"select-airport-cols": {
			"inputId": "stg-airports",
			"metadata": {
				"feed": "compute"
			},
			"outputId": "int-airports",
			"transformers": [
				{
					"code": "select ident, name, latitude_deg, longitude_deg from stg_airports",
					"type": "SQLDfTransformer"
				}
			],
			"type": "CopyAction"
		}
	},
	"dataObjects": {
		"btl-departures-arrivals-airports": {
			"path": "~{id}",
			"type": "CsvFileDataObject"
		},
		"btl-distances": {
			"path": "~{id}",
			"type": "CsvFileDataObject"
		},
		"ext-airports": {
			"followRedirects": true,
			"readTimeoutMs": 200000,
			"type": "WebserviceFileDataObject",
			"url": "https://ourairports.com/data/airports.csv"
		},
		"ext-departures": {
			"readTimeoutMs": 200000,
			"type": "WebserviceFileDataObject",
			"url": "https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979"
		},
		"int-airports": {
			"path": "~{id}",
			"type": "CsvFileDataObject"
		},
		"stg-airports": {
			"path": "~{id}",
			"type": "CsvFileDataObject"
		},
		"stg-departures": {
			"path": "~{id}",
			"type": "JsonFileDataObject"
		}
	},
	"global": {
		"spark-options": {
			"spark.sql.shuffle.partitions": 2
		}
	}
}

function createRow(key, value) {
  return { key, value };
}

function createActionRows(jsonObject, actionName){
  var keyList = Object.keys(jsonObject['actions'][actionName]);
  return keyList.map(key => createRow(key, JSON.stringify(jsonObject['actions'][actionName][key], null, '\t')));
}

var result = createActionRows(file, 'compute-distances');

console.log("Hello");



/*

// JSON object
const data = {
    'compute-distances': {
      inputId: 'btl-departures-arrivals-airports',
      metadata: { feed: 'compute' },
      outputId: 'btl-distances',
      transformers: [ [Object] ],
      type: 'CopyAction'
    },
    'download-airports': {
      inputId: 'ext-airports',
      metadata: { feed: 'download' },
      outputId: 'stg-airports',
      type: 'FileTransferAction'
    },
    'download-departures': {
      inputId: 'ext-departures',
      metadata: { feed: 'download' },
      outputId: 'stg-departures',
      type: 'FileTransferAction'
    },
    'join-departures-airports': {
      inputIds: [ 'stg-departures', 'int-airports' ],
      metadata: { feed: 'compute' },
      outputIds: [ 'btl-departures-arrivals-airports' ],
      transformers: [ [Object], [Object] ],
      type: 'CustomSparkAction'
    },
    'select-airport-cols': {
      inputId: 'stg-airports',
      metadata: { feed: 'compute' },
      outputId: 'int-airports',
      transformers: [ [Object] ],
      type: 'CopyAction'
    }
  }





console.log(Object.keys(data)); //Get all keys at a certain level of the JSON object (e.g. the name of all Actions)

if (data['join-departures-airports']['outputIds'] === undefined){
  console.log(data['join-departures-airports']['outputId']);
}
else{
  console.log(data['join-departures-airports']['outputIds']);
}



var list = [];
if (list[0] === undefined){list[0]=1;} else {list[0] = list[0]+1;}
console.log(list[0]);

*/




