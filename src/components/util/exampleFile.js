export default {
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
		"download-deduplicate-departures": {
			"executionMode": {
				"type": "DataObjectStateIncrementalMode"
			},
			"inputId": "ext-departures",
			"mergeModeEnable": true,
			"metadata": {
				"feed": "compute"
			},
			"outputId": "int-departures",
			"transformers": [
				{
					"code": "select ext_departures.*, date_format(from_unixtime(firstseen),'yyyyMMdd') dt from ext_departures",
					"type": "SQLDfTransformer"
				},
				{
					"code": "\r\n      import org.apache.spark.sql.{DataFrame, SparkSession}\r\n      def transform(session: SparkSession, options: Map[String,String], df: DataFrame, dataObjectId: String) : DataFrame = {\r\n        import session.implicits._\r\n        df.dropDuplicates(\"icao24\", \"estdepartureairport\", \"dt\")\r\n      }\r\n      // return as function\r\n      transform _\r\n    ",
					"type": "ScalaCodeDfTransformer"
				}
			],
			"type": "DeduplicateAction",
			"updateCapturedColumnOnlyWhenChanged": true
		},
		"historize-airports": {
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
			"type": "HistorizeAction"
		},
		"join-departures-airports": {
			"inputIds": [
				"int-departures",
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
						"btl-connected-airports": "\r\n          select int_departures.estdepartureairport, int_departures.estarrivalairport,\r\n            airports.*\r\n          from int_departures join int_airports airports on int_departures.estArrivalAirport = airports.ident\r\n        "
					},
					"type": "SQLDfsTransformer"
				},
				{
					"code": {
						"btl-departures-arrivals-airports": "\r\n            select btl_connected_airports.estdepartureairport, btl_connected_airports.estarrivalairport,\r\n              btl_connected_airports.name as arr_name, btl_connected_airports.latitude_deg as arr_latitude_deg, btl_connected_airports.longitude_deg as arr_longitude_deg,\r\n              airports.name as dep_name, airports.latitude_deg as dep_latitude_deg, airports.longitude_deg as dep_longitude_deg\r\n            from btl_connected_airports join int_airports airports on btl_connected_airports.estdepartureairport = airports.ident\r\n          "
					},
					"type": "SQLDfsTransformer"
				}
			],
			"type": "CustomSparkAction"
		}
	},
	"dataObjects": {
		"btl-departures-arrivals-airports": {
			"path": "~{id}",
			"table": {
				"db": "default",
				"name": "btl_departures_arrivals_airports"
			},
			"type": "DeltaLakeTableDataObject"
		},
		"btl-distances": {
			"path": "~{id}",
			"table": {
				"db": "default",
				"name": "btl_distances"
			},
			"type": "DeltaLakeTableDataObject"
		},
		"ext-airports": {
			"followRedirects": true,
			"readTimeoutMs": 200000,
			"type": "WebserviceFileDataObject",
			"url": "https://ourairports.com/data/airports.csv"
		},
		"ext-departures": {
			"baseUrl": "https://opensky-network.org/api/flights/departure",
			"nRetry": 5,
			"queryParameters": [
				{
					"airport": "LSZB",
					"begin": 1641393602,
					"end": 1641483739
				},
				{
					"airport": "EDDF",
					"begin": 1641393602,
					"end": 1641483739
				}
			],
			"schema": "array< struct< icao24: string, firstSeen: integer, estDepartureAirport: string, lastSeen: integer, estArrivalAirport: string, callsign: string, estDepartureAirportHorizDistance: integer, estDepartureAirportVertDistance: integer, estArrivalAirportHorizDistance: integer, estArrivalAirportVertDistance: integer, departureAirportCandidatesCount: integer, arrivalAirportCandidatesCount: integer >>",
			"timeouts": {
				"connectionTimeoutMs": 200000,
				"readTimeoutMs": 200000
			},
			"type": "CustomWebserviceDataObject"
		},
		"int-airports": {
			"path": "~{id}",
			"table": {
				"db": "default",
				"name": "int_airports",
				"primaryKey": [
					"ident"
				]
			},
			"type": "DeltaLakeTableDataObject"
		},
		"int-departures": {
			"path": "~{id}",
			"table": {
				"db": "default",
				"name": "int_departures",
				"primaryKey": [
					"icao24",
					"estdepartureairport",
					"dt"
				]
			},
			"type": "DeltaLakeTableDataObject"
		},
		"stg-airports": {
			"path": "~{id}",
			"type": "CsvFileDataObject"
		}
	},
	"global": {
		"spark-options": {
			"spark.databricks.delta.snapshotPartitions": 2,
			"spark.hadoop.javax.jdo.option.ConnectionDriverName": "org.apache.derby.jdbc.ClientDriver",
			"spark.hadoop.javax.jdo.option.ConnectionPassword": "1234",
			"spark.hadoop.javax.jdo.option.ConnectionURL": "jdbc:derby://metastore:1527/db;create=true",
			"spark.hadoop.javax.jdo.option.ConnectionUserName": "sa",
			"spark.sql.shuffle.partitions": 2
		}
	}
}