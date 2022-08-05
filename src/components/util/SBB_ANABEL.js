export default {
	"actions": {
		"atl_fahrweg_gleiskante": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_fahrweg_gleiskante"
			],
			"metadata": {
				"feed": "bew_atl_fahrweg_gleiskante"
			},
			"outputIds": [
				"atl_fahrweg_gleiskante"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLFahrwegGleiskanteTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"atl_fahrweg_gtgstrang": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_fahrweg_gtgstrang"
			],
			"metadata": {
				"feed": "bew_atl_fahrweg_gtgstrang"
			},
			"outputIds": [
				"atl_fahrweg_gtgstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLFahrwegGtgstrangTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"atl_formation": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_zuglauf",
				"stg_formation"
			],
			"metadata": {
				"feed": "bew_atl_formation"
			},
			"outputIds": [
				"atl_formation"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLFormationTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"atl_gefahrgut": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_formation",
				"atl_zuglauf",
				"stg_stammdaten_zugkategorie",
				"stg_stammdaten_gefahrgut_bezeichnungen",
				"stg_stammdaten_gefahrgut_gefahrgutklassen",
				"stg_stammdaten_gefahrgut_leitstoff"
			],
			"metadata": {
				"feed": "bew_atl_gefahrgut"
			},
			"outputIds": [
				"atl_gefahrgut"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLGefahrgutTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"atl_zuglauf": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_zuglauf"
			],
			"metadata": {
				"feed": "bew_atl_zuglauf"
			},
			"outputIds": [
				"atl_zuglauf"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLZuglaufTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"atl_zuglauf_strecke": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_betriebspunkt",
				"stg_zuglauf_strecke_wegfilter"
			],
			"metadata": {
				"feed": "bew_atl_zuglauf_strecke"
			},
			"outputIds": [
				"atl_zuglauf_strecke"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.atl.ATLZuglaufStreckeTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"file_fzg_stammdaten": {
			"inputId": "git_fzg_stammdaten",
			"metadata": {
				"feed": "fzg_stammdaten_file"
			},
			"outputId": "file_fzg_stammdaten",
			"type": "FileTransferAction"
		},
		"file_fzg_stammdaten_config": {
			"inputId": "git_fzg_stammdaten_config",
			"metadata": {
				"feed": "fzg_stammdaten_file"
			},
			"outputId": "file_fzg_stammdaten_config",
			"type": "FileTransferAction"
		},
		"file_stammdaten_gefahrgut_bezeichnungen": {
			"inputId": "git_stammdaten_gefahrgut_bezeichnungen",
			"metadata": {
				"feed": "gefahrgut_bezeichnungen_file"
			},
			"outputId": "file_stammdaten_gefahrgut_bezeichnungen",
			"type": "FileTransferAction"
		},
		"file_stammdaten_gefahrgut_gefahrgutklassen": {
			"inputId": "git_stammdaten_gefahrgut_gefahrgutklassen",
			"metadata": {
				"feed": "gefahrgut_gefahrgutklassen_file"
			},
			"outputId": "file_stammdaten_gefahrgut_gefahrgutklassen",
			"type": "FileTransferAction"
		},
		"file_stammdaten_gefahrgut_leitstoff": {
			"inputId": "git_stammdaten_gefahrgut_leitstoff",
			"metadata": {
				"feed": "gefahrgut_leitstoff_file"
			},
			"outputId": "file_stammdaten_gefahrgut_leitstoff",
			"type": "FileTransferAction"
		},
		"file_stammdaten_zugkategorie": {
			"inputId": "git_stammdaten_zugkategorie",
			"metadata": {
				"feed": "zugkategorie_file"
			},
			"outputId": "file_stammdaten_zugkategorie",
			"type": "FileTransferAction"
		},
		"fzg_stammdaten": {
			"inputIds": [
				"file_fzg_stammdaten",
				"file_fzg_stammdaten_config"
			],
			"metadata": {
				"feed": "fzg_stammdaten_stg"
			},
			"outputIds": [
				"fzg_stammdaten"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stammdaten.StammdatenTransformer",
				"options": {
					"dts": "20210127",
					"hdfs-dir": "hdfs://nameservice1/user/fbd_lab_anabel/stage/anabel/stammdaten_git/data",
					"loaddate": 20210127,
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"neig_gleisbelastung": {
			"inputIds": [
				"stg_gtgstrang",
				"atl_fahrweg_gtgstrang",
				"atl_formation",
				"atl_zuglauf",
				"stg_stammdaten_zugkategorie"
			],
			"metadata": {
				"feed": "neig_gleisbelastung"
			},
			"outputIds": [
				"neig_gleisbelastung"
			],
			"recursiveInputIds": [
				"neig_gleisbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.neig.NeigGleisbelastungTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"neig_streckenbelastung": {
			"inputIds": [
				"stg_strecken_dfa",
				"atl_formation",
				"atl_zuglauf_strecke",
				"atl_zuglauf",
				"stg_stammdaten_zugkategorie"
			],
			"metadata": {
				"feed": "neig_streckenbelastung"
			},
			"outputIds": [
				"neig_streckenbelastung"
			],
			"recursiveInputIds": [
				"neig_streckenbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.neig.NeigStreckenbelastungTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"quality_monitoring_jahr": {
			"breakDataFrameLineage": true,
			"executionMode": null,
			"inputIds": [
				"quality_monitoring_tag"
			],
			"metadata": {
				"feed": "quality_monitoring_jahr"
			},
			"outputIds": [
				"quality_monitoring_jahr"
			],
			"recursiveInputIds": [
				"quality_monitoring_jahr"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.monitoring.MonitoringJahrTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"quality_monitoring_tag": {
			"breakDataFrameLineage": true,
			"executionMode": null,
			"inputIds": [
				"atl_zuglauf_strecke",
				"atl_fahrweg_gtgstrang",
				"atl_zuglauf",
				"atl_formation"
			],
			"metadata": {
				"feed": "quality_monitoring_tag"
			},
			"outputIds": [
				"quality_monitoring_tag"
			],
			"recursiveInputIds": [
				"quality_monitoring_tag"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.monitoring.MonitoringTagTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				},
				"runtimeOptions": {
					"executionPhase": "executionPhase"
				}
			},
			"type": "CustomSparkAction"
		},
		"rep_gefahrengut_gtg": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_gefahrgut",
				"atl_fahrweg_gtgstrang"
			],
			"metadata": {
				"feed": "rep_gefahrengut_gtg"
			},
			"outputIds": [
				"rep_gefahrengut_gtg"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.gefahrgut.RepGefahrengutGtgTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"rep_laerm_gleisbelastung": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_fahrweg_gtgstrang",
				"atl_formation",
				"atl_zuglauf"
			],
			"metadata": {
				"feed": "rep_laerm_gleisbelastung"
			},
			"outputIds": [
				"rep_laerm_gleisbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.laerm.LaermreportingGleisbelastungTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"rep_laerm_streckenbelastung": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_formation",
				"atl_zuglauf",
				"atl_zuglauf_strecke",
				"ihpt_ft",
				"stg_cis_bremsbauart"
			],
			"metadata": {
				"feed": "rep_laerm_streckenbelastung"
			},
			"outputIds": [
				"rep_laerm_streckenbelastung_pre",
				"rep_laerm_streckenbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.laerm.LaermreportingStreckenbelastungTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"rep_laerm_zuganzahl": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_zuglauf",
				"atl_zuglauf_strecke"
			],
			"metadata": {
				"feed": "rep_laerm_zuganzahl"
			},
			"outputIds": [
				"rep_laerm_zuganzahl"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.laerm.LaermreportingZuganzahlTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"reporting_gefahrengut_strecke": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_gefahrgut",
				"atl_zuglauf_strecke"
			],
			"metadata": {
				"feed": "bew_reporting_gefahrengut_strecke"
			},
			"outputIds": [
				"reporting_gefahrengut_strecke"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.gefahrgut.RepGefahrengutStreckeTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"reporting_gleisbelastung": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_fahrweg_gtgstrang",
				"atl_formation",
				"atl_zuglauf",
				"stg_stammdaten_zugkategorie"
			],
			"metadata": {
				"feed": "bew_reporting_gleisbelastung"
			},
			"outputIds": [
				"reporting_gleisbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.ReportingGleisbelastungTransformer",
				"options": {
					"dts": "20210127",
					"jdbc-output-partitions": 3,
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"reporting_streckenbelastung": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"atl_formation",
				"atl_zuglauf_strecke",
				"atl_zuglauf",
				"uno_betriebspunkt",
				"stg_stammdaten_zugkategorie"
			],
			"metadata": {
				"feed": "bew_reporting_streckenbelastung"
			},
			"outputIds": [
				"reporting_streckenbelastung"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.reporting.ReportingStreckenbelastungTransformer",
				"options": {
					"dts": "20210127",
					"jdbc-output-partitions": 3,
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_befahrbarkeit": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_strecken_dfa"
			],
			"metadata": {
				"feed": "stamm_stg_befahrbarkeit"
			},
			"outputIds": [
				"stg_befahrbarkeit"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.befahrbarkeit.BefahrbarkeitTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_betriebspunkt": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"dfagis_betriebspunkt",
				"uno_betriebspunkt"
			],
			"metadata": {
				"feed": "stamm_stg_betriebspunkt"
			},
			"outputIds": [
				"stg_betriebspunkt"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.BetriebspunktTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_fahrweg_gleiskante": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"rcs_fahrweg",
				"stg_zuglauf"
			],
			"metadata": {
				"feed": "bew_stg_fahrweg_gleiskante"
			},
			"outputIds": [
				"stg_fahrweg_gleiskante"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.FahrwegGkTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_fahrweg_gtgstrang": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_fahrweg_gleiskante",
				"stg_gleiskante_clean",
				"stg_gleiskante_gtgstrang_mapping",
				"stg_gtg2strecke",
				"stg_positionspunkt_dinar_dgp_plus"
			],
			"metadata": {
				"feed": "bew_stg_fahrweg_gtgstrang"
			},
			"outputIds": [
				"stg_fahrweg_gtgstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.FahrwegGtgTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_formation": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_formation_ihpt",
				"stg_formation_rcs"
			],
			"metadata": {
				"feed": "bew_stg_formation"
			},
			"outputIds": [
				"stg_formation"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.formation.JoinedTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_formation_ihpt": {
			"executionMode": {
				"alternativeOutputId": "atl_zuglauf_strecke",
				"failCondition": "(size(selectedInputPartitionValues) = 0)",
				"type": "PartitionDiffMode"
			},
			"inputIds": [
				"ihpt_tf"
			],
			"metadata": {
				"feed": "bew_stg_formation_ihpt"
			},
			"outputIds": [
				"stg_formation_ihpt"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.formation.IHPTTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_formation_rcs": {
			"executionMode": {
				"alternativeOutputId": "atl_zuglauf_strecke",
				"failCondition": "(size(selectedInputPartitionValues) = 0)",
				"type": "PartitionDiffMode"
			},
			"inputIds": [
				"rcs_formation",
				"ana1_formation_footprint",
				"ana1_grundtyp",
				"ana1_fahrtyp_mapping",
				"ana1_grundtyp_mapping",
				"uno_betriebspunkt",
				"uno_mitte_ag",
				"rcs_zuglauf"
			],
			"mainInputId": "rcs_formation",
			"metadata": {
				"feed": "bew_stg_formation_rcs"
			},
			"outputIds": [
				"stg_formation_rcs"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.formation.RCSTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true,
					"schiebelok-bps": "ER,GOE,AI,BEL,SPAO,TH,SP,KA,GO,FERD,BR,DOFS"
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_gleiskante2gleisstrang": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_strecken_dfa",
				"stg_gleiskante_gtgstrang_mapping",
				"stg_gtg2gleisstrang",
				"stg_strecke_gleis_bezug"
			],
			"metadata": {
				"feed": "stamm_stg_gleiskante2gleisstrang"
			},
			"outputIds": [
				"stg_gleiskante2gleisstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.Gk2gsTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_gleiskante_gtgstrang_mapping": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_positionspunkt_dinar_dgp_plus",
				"stg_gleiskante_plus",
				"stg_positionspunkt_gleiskante",
				"stg_positionspunkt_gtgstrang"
			],
			"metadata": {
				"feed": "stamm_stg_gleiskante_gtgstrang_mapping"
			},
			"outputIds": [
				"stg_gleiskante_gtgstrang_mapping"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.GleiskanteGTGStrangMappingTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_gtg2gleisstrang": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_gtgstrang",
				"dmd_gs2gtg"
			],
			"metadata": {
				"feed": "stamm_stg_gtg2gleisstrang"
			},
			"outputIds": [
				"stg_gtg2gleisstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.Gtg2gsTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_gtg2strecke": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_strecken_dfa",
				"stg_strecke_gleis_bezug",
				"stg_gtg2gleisstrang"
			],
			"metadata": {
				"feed": "stamm_stg_gtg2strecke"
			},
			"outputIds": [
				"stg_gtg2strecke_pre",
				"stg_gtg2strecke"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.Gtg2StreckeTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_gtgstrang": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"dinar_gtgstrang"
			],
			"metadata": {
				"feed": "stamm_stg_gtgstrang"
			},
			"outputIds": [
				"stg_gtgstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.GtgTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_mag_ignorandum": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_mag_strecke"
			],
			"metadata": {
				"feed": "stamm_stg_mag_ignorandum"
			},
			"outputIds": [
				"stg_mag_ignorandum"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.MagIgnorandumTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_mag_strecke": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_betriebspunkt",
				"stg_gleiskante_gtgstrang_mapping",
				"stg_gtg2strecke",
				"uno_mitte_ag"
			],
			"metadata": {
				"feed": "stamm_stg_mag_strecke"
			},
			"outputIds": [
				"stg_mag_strecke"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.Mag2StreckeTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_positionspunkt_dinar_dgp_plus": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"dgp_netzelemente",
				"dinar_gtgstrang",
				"dinar_gtgweiche",
				"anabel_gtgstrang_plus"
			],
			"metadata": {
				"feed": "stamm_stg_positionspunkt_dinar_dgp_plus"
			},
			"outputIds": [
				"stg_positionspunkt_dinar_dgp_plus"
			],
			"recursiveInputIds": [
				"stg_positionspunkt_dinar_dgp_plus"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.DinarDGPPlusTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_positionspunkt_gleiskante": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_gleiskante_plus"
			],
			"metadata": {
				"feed": "stamm_stg_positionspunkt_gleiskante"
			},
			"outputIds": [
				"stg_positionspunkt",
				"stg_positionspunkt_gleiskante"
			],
			"recursiveInputIds": [
				"stg_positionspunkt",
				"stg_positionspunkt_gleiskante"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.PositionspunktGleiskanteTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_positionspunkt_gtgstrang": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_positionspunkt_dinar_dgp_plus",
				"stg_positionspunkt"
			],
			"metadata": {
				"feed": "stamm_stg_positionspunkt_gtgstrang"
			},
			"outputIds": [
				"stg_positionspunkt_gtgstrang"
			],
			"recursiveInputIds": [
				"stg_positionspunkt_gtgstrang"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.PositionspunktGTGStrangTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				},
				"runtimeOptions": {
					"executionPhase": "executionPhase"
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_positionspunkt_uno_clean": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"uno_gleiskante",
				"uno_gleisknoten",
				"uno_gleispunkt"
			],
			"metadata": {
				"feed": "stamm_stg_positionspunkt_uno_clean"
			},
			"outputIds": [
				"stg_gleiskante_clean",
				"stg_gleisknoten_clean",
				"stg_gleispunkt_clean"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.UNOCleanTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_positionspunkt_uno_plus": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"uno_weichengrenze",
				"stg_gleisknoten_clean",
				"stg_gleiskante_clean",
				"stg_gleispunkt_clean"
			],
			"metadata": {
				"feed": "stamm_stg_positionspunkt_uno_plus"
			},
			"outputIds": [
				"stg_gleiskante_plus"
			],
			"recursiveInputIds": [
				"stg_gleiskante_plus"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.UNOPlusTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_stammdaten_gefahrgut_bezeichnungen": {
			"inputIds": [
				"file_stammdaten_gefahrgut_bezeichnungen"
			],
			"metadata": {
				"feed": "gefahrgut_bezeichnungen_stg"
			},
			"outputIds": [
				"stg_stammdaten_gefahrgut_bezeichnungen"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stammdaten.GefahrgutBezeichnungenTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_stammdaten_gefahrgut_gefahrgutklassen": {
			"inputIds": [
				"file_stammdaten_gefahrgut_gefahrgutklassen"
			],
			"metadata": {
				"feed": "gefahrgut_gefahrgutklassen_stg"
			},
			"outputIds": [
				"stg_stammdaten_gefahrgut_gefahrgutklassen"
			],
			"recursiveInputIds": [
				"stg_stammdaten_gefahrgut_gefahrgutklassen"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stammdaten.GefahrgutGefahrgutklassenTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_stammdaten_gefahrgut_leitstoff": {
			"inputIds": [
				"file_stammdaten_gefahrgut_leitstoff"
			],
			"metadata": {
				"feed": "gefahrgut_leitstoff_stg"
			},
			"outputIds": [
				"stg_stammdaten_gefahrgut_leitstoff"
			],
			"recursiveInputIds": [
				"stg_stammdaten_gefahrgut_leitstoff"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stammdaten.GefahrgutLeitstoffRisikenTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_stammdaten_zugkategorie": {
			"inputId": "file_stammdaten_zugkategorie",
			"metadata": {
				"feed": "zugkategorie_stg"
			},
			"outputId": "stg_stammdaten_zugkategorie",
			"type": "CopyAction"
		},
		"stg_strecke_gleis_bezug": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_strecken_dfa",
				"dfagis_strecken_gleis_bezug"
			],
			"metadata": {
				"feed": "stamm_stg_strecke_gleis_bezug"
			},
			"outputIds": [
				"stg_strecke_gleis_bezug"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.positionspunkt.StreckeGleisTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_strecken_dfa": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_betriebspunkt",
				"dfagis_strecke",
				"dfagis_linie",
				"dfagis_streckengeometrie"
			],
			"metadata": {
				"feed": "stamm_stg_strecken_dfa"
			},
			"outputIds": [
				"stg_strecken_dfa"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.StreckenDfaTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_streckenkombination": {
			"breakDataFrameLineage": true,
			"inputIds": [
				"stg_befahrbarkeit",
				"stg_strecken_dfa"
			],
			"metadata": {
				"feed": "stamm_stg_streckenkombination"
			},
			"outputIds": [
				"stg_streckenkombination"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.StreckenkombinationTransformer",
				"options": {
					"dts": "20210127",
					"max-tiefe": 4,
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_zuglauf": {
			"executionMode": {
				"alternativeOutputId": "atl_zuglauf_strecke",
				"failCondition": "(size(selectedInputPartitionValues) = 0)",
				"type": "PartitionDiffMode"
			},
			"inputIds": [
				"rcs_zuglauf",
				"uno_mitte_ag",
				"uno_signal"
			],
			"metadata": {
				"feed": "bew_stg_zuglauf"
			},
			"outputIds": [
				"stg_zuglauf"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.ZuglaufTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_zuglauf_ignorandum": {
			"executionMode": {
				"alternativeOutputId": "atl_zuglauf_strecke",
				"failCondition": "(size(selectedInputPartitionValues) = 0)",
				"type": "PartitionDiffMode"
			},
			"inputIds": [
				"rcs_zuglauf",
				"stg_betriebspunkt",
				"stg_mag_ignorandum"
			],
			"metadata": {
				"feed": "bew_stg_zuglauf_ignorandum"
			},
			"outputIds": [
				"stg_zuglauf_ignorandum"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.ZuglaufIgnorandumTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_zuglauf_strecke": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_streckenkombination",
				"stg_strecken_dfa",
				"stg_zuglauf_ignorandum"
			],
			"metadata": {
				"feed": "bew_stg_zuglauf_strecke"
			},
			"outputIds": [
				"stg_zuglauf_strecke"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.ZuglaufStreckeTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		},
		"stg_zuglauf_strecke_wegfilter": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"inputIds": [
				"stg_fahrweg_gtgstrang",
				"stg_strecken_dfa",
				"stg_zuglauf_strecke"
			],
			"metadata": {
				"feed": "bew_stg_zuglauf_strecke_wegfilter"
			},
			"outputIds": [
				"stg_zuglauf_strecke_wegfilter"
			],
			"transformer": {
				"class-name": "ch.sbb.bigdata.anabel.stg.zuglauf.ZuglaufStreckeWegfilterTransformer",
				"options": {
					"dts": "20210127",
					"require-partitions-existing": true
				}
			},
			"type": "CustomSparkAction"
		}
	},
	"connections": {
		"anabelAtlLayerConnection": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"db": "lab_anabel",
			"path-prefix": "hdfs://nameservice1/user/fbd_lab_anabel/atl/",
			"type": "HiveTableConnection"
		},
		"anabelGenericLayerConnection": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"db": "lab_anabel",
			"path-prefix": "hdfs://nameservice1/user/fbd_lab_anabel",
			"type": "HiveTableConnection"
		},
		"anabelNeigLayerConnection": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"db": "lab_anabel",
			"path-prefix": "hdfs://nameservice1/user/fbd_lab_anabel/neig/",
			"type": "HiveTableConnection"
		},
		"anabelRepLayerConnection": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"db": "lab_anabel",
			"path-prefix": "hdfs://nameservice1/user/fbd_lab_anabel/rep/",
			"type": "HiveTableConnection"
		},
		"anabelStageLayerConnection": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"db": "lab_anabel",
			"path-prefix": "hdfs://nameservice1/user/fbd_lab_anabel/stage/",
			"type": "HiveTableConnection"
		},
		"jdbcReportingConnection": {
			"authMode": {
				"passwordVariable": "CLEAR#changeme",
				"type": "BasicAuthMode",
				"userVariable": "CLEAR#GSU_ANABEL"
			},
			"db": "GSU_ANABEL",
			"driver": "oracle.jdbc.driver.OracleDriver",
			"type": "JdbcTableConnection",
			"url": "jdbc:oracle:thin:@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=porasbbselscan.sbb.ch)(PORT=1551))(CONNECT_DATA=(SERVICE_NAME=GS_ANABEL_ENTW)))"
		}
	},
	"dataObjects": {
		"ana1_fahrtyp_mapping": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"ana1_formation_footprint": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"ana1_grundtyp": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"ana1_grundtyp_mapping": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"anabel_gtgstrang_plus": {
			"table": {
				"db": "app_anabel",
				"name": "dinar_gtgstrang_plus"
			},
			"type": "HiveTableDataObject"
		},
		"atl_fahrweg_gleiskante": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/fahrweg_gleiskante/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"atl_fahrweg_gtgstrang": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/fahrweg_gtgstrang/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"atl_formation": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/formation/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_formation",
					"position"
				]
			},
			"type": "HiveTableDataObject"
		},
		"atl_gefahrgut": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/gefahrgut/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"zuglauf_reihenfolge",
					"position",
					"un_stoffnummer"
				]
			},
			"type": "HiveTableDataObject"
		},
		"atl_zuglauf": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/zuglauf/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"atl_zuglauf_strecke": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/zuglauf_strecke/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"dfagis_betriebspunkt": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dfagis_os_betriebspunkt_hist"
			},
			"type": "HiveTableDataObject"
		},
		"dfagis_linie": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dfagis_os_linie_hist"
			},
			"type": "HiveTableDataObject"
		},
		"dfagis_strecke": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dfagis_os_strecke_hist"
			},
			"type": "HiveTableDataObject"
		},
		"dfagis_strecken_gleis_bezug": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dfagis_os_strecken_gleis_bezug"
			},
			"type": "HiveTableDataObject"
		},
		"dfagis_streckengeometrie": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dfagis_os_streckengeometrie_hist"
			},
			"type": "HiveTableDataObject"
		},
		"dgp_netzelemente": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dgp_netzelemente"
			},
			"type": "HiveTableDataObject"
		},
		"dinar_gtgstrang": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dinar_gtgstrang"
			},
			"type": "HiveTableDataObject"
		},
		"dinar_gtgweiche": {
			"table": {
				"db": "app_datalake",
				"name": "btl_dinar_gtgweiche"
			},
			"type": "HiveTableDataObject"
		},
		"dmd_gs2gtg": {
			"partitions": [
				"dt"
			],
			"table": {
				"db": "app_diamond",
				"name": "int_dmd_gs2gtg"
			},
			"type": "HiveTableDataObject"
		},
		"file_fzg_stammdaten": {
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stage/anabel/stammdaten_git/data/20210127/fzgstammdaten.json",
			"saveMode": "Overwrite",
			"type": "JsonFileDataObject"
		},
		"file_fzg_stammdaten_config": {
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stage/anabel/stammdaten_git/data/20210127/fzgstammdaten.config.json",
			"saveMode": "Overwrite",
			"type": "JsonFileDataObject"
		},
		"file_stammdaten_gefahrgut_bezeichnungen": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"csv-options": {
				"delimiter": ";",
				"encoding": "UTF-8",
				"escape": "\\",
				"header": "true",
				"inferSchema": true,
				"quote": "\""
			},
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stammdaten/gefahrgut/UN_Bezeichnungen.csv",
			"saveMode": "Overwrite",
			"type": "CsvFileDataObject"
		},
		"file_stammdaten_gefahrgut_gefahrgutklassen": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"csv-options": {
				"delimiter": ";",
				"encoding": "UTF-8",
				"escape": "\\",
				"header": "true",
				"inferSchema": true,
				"quote": "\""
			},
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stammdaten/gefahrgut/UN_Gefahrgutklassen.csv",
			"saveMode": "Overwrite",
			"type": "CsvFileDataObject"
		},
		"file_stammdaten_gefahrgut_leitstoff": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"csv-options": {
				"delimiter": ";",
				"encoding": "UTF-8",
				"escape": "\\",
				"header": "true",
				"inferSchema": "true",
				"quote": "\""
			},
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stammdaten/gefahrgut/UN_Leitstoff_Risiken.csv",
			"saveMode": "Overwrite",
			"type": "CsvFileDataObject"
		},
		"file_stammdaten_zugkategorie": {
			"csv-options": {
				"delimiter": ",",
				"encoding": "UTF-8",
				"escape": "\\",
				"header": "true",
				"inferSchema": true,
				"quote": "\""
			},
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stammdaten/zugkategorie/ZugkategorienANA2.csv",
			"saveMode": "Overwrite",
			"type": "CsvFileDataObject"
		},
		"fzg_stammdaten": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"path": "hdfs://nameservice1/user/fbd_lab_anabel/stammdaten/fzg_stammdaten/data",
			"table": {
				"db": "lab_anabel",
				"name": "git_fzg_stammdaten"
			},
			"type": "HiveTableDataObject"
		},
		"git_fzg_stammdaten": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/fahrzeug/Fzgstammdaten.json"
		},
		"git_fzg_stammdaten_config": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/fahrzeug/Fzgstammdaten.config.json"
		},
		"git_stammdaten_gefahrgut_bezeichnungen": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/gefahrgut/UN_Bezeichnungen.csv?at=refs%2Fheads%2Fdevelop"
		},
		"git_stammdaten_gefahrgut_gefahrgutklassen": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/gefahrgut/UN_Gefahrgutklassen.csv?at=refs%2Fheads%2Fdevelop"
		},
		"git_stammdaten_gefahrgut_leitstoff": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/gefahrgut/UN_Leitstoff_Risiken.csv?at=refs%2Fheads%2Fdevelop"
		},
		"git_stammdaten_zugkategorie": {
			"authMode": {
				"secretVariable": "CLEAR#Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
				"type": "AuthHeaderMode"
			},
			"type": "WebserviceFileDataObject",
			"url": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel-stammdaten/raw/zugkategorie/ZugkategorienANA2.csv?at=refs%2Fheads%2Fdevelop"
		},
		"ihpt_ft": {
			"expectedPartitionsCondition": "elements['dt'] >= 20171211",
			"partitions": [],
			"table": {
				"db": "app_datalake",
				"name": "int_ihpt_fos_fahrtyp"
			},
			"type": "HiveTableDataObject"
		},
		"ihpt_tf": {
			"expectedPartitionsCondition": "elements['dt'] >= 20171211",
			"partitions": [
				"dt"
			],
			"table": {
				"db": "app_datalake",
				"name": "int_ihpt_fos_tf"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"neig_gleisbelastung": {
			"connectionId": "anabelNeigLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"neig_streckenbelastung": {
			"connectionId": "anabelNeigLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"quality_monitoring_jahr": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data/",
			"table": {
				"name": "quality_monitoring_jahr",
				"primary-key": [
					"dt"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"quality_monitoring_tag": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data/",
			"schemaMin": "dt STRING,streckenschaerfe_tag DOUBLE,streckenabfolge_tag DOUBLE,gtgabfolge_tag DOUBLE,gtgschaerfe_tag DOUBLE,gtgfahrwegabschluss_tag DOUBLE,formationsvollstaendigkeit_tag DOUBLE,formationsschaerfe_tag DOUBLE",
			"table": {
				"name": "quality_monitoring_tag",
				"primary-key": [
					"dt"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"rcs_fahrweg": {
			"expectedPartitionsCondition": "elements['dt'] not in ('20121027','20130328','20131026','20160424','20160425','20160426','20160520','20160521','20160522','20160523')",
			"partitions": [
				"dt"
			],
			"table": {
				"db": "app_datalake",
				"name": "btl_rcsarchiv_fahrweg"
			},
			"type": "HiveTableDataObject"
		},
		"rcs_formation": {
			"expectedPartitionsCondition": "elements['dt'] not in ('20121027','20130328','20131026','20160424','20160425','20160426','20160520','20160521','20160522','20160523')",
			"partitions": [
				"dt"
			],
			"table": {
				"db": "app_datalake",
				"name": "btl_rcsarchiv_formation"
			},
			"type": "HiveTableDataObject"
		},
		"rcs_zuglauf": {
			"expectedPartitionsCondition": "elements['dt'] not in ('20121027','20130328','20131026','20160424','20160425','20160426','20160520','20160521','20160522','20160523')",
			"partitions": [
				"dt"
			],
			"table": {
				"db": "app_datalake",
				"name": "btl_rcsarchiv_zuglauf"
			},
			"type": "HiveTableDataObject"
		},
		"rep_gefahrengut_gtg": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"zuglauf_reihenfolge",
					"position",
					"un_stoffnummer",
					"fahrweg_gtg_reihenfolge"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"rep_laerm_gleisbelastung": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"rep_laerm_streckenbelastung": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"id_strecke",
					"stunde",
					"jahr",
					"monat",
					"zka_id",
					"basistyp",
					"bremsbauart",
					"bremsbelag",
					"fahrzeugkategorie"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"rep_laerm_streckenbelastung_pre": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"reihenfolge",
					"id_strecke",
					"formation_pos"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"rep_laerm_zuganzahl": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"reporting_gefahrengut_strecke": {
			"connectionId": "jdbcReportingConnection",
			"preWriteSql": "call truncate_partition('gefahrengut_strecke','20210127')",
			"saveMode": "Append",
			"table": {
				"name": "gefahrengut_strecke"
			},
			"type": "JdbcTableDataObject"
		},
		"reporting_gleisbelastung": {
			"connectionId": "jdbcReportingConnection",
			"preWriteSql": "call truncate_partition('gleisbelastung','20210127')",
			"saveMode": "Append",
			"table": {
				"name": "gleisbelastung"
			},
			"type": "JdbcTableDataObject"
		},
		"reporting_streckenbelastung": {
			"connectionId": "jdbcReportingConnection",
			"preWriteSql": "call truncate_partition('streckenbelastung','20210127')",
			"saveMode": "Append",
			"table": {
				"name": "streckenbelastung"
			},
			"type": "JdbcTableDataObject"
		},
		"stg_befahrbarkeit": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_betriebspunkt": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_cis_bremsbauart": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}",
				"primary-key": [
					"datum_prd",
					"trassenid",
					"wagennummer"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_fahrweg_gleiskante": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"reihenfolge"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_fahrweg_gtgstrang": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"reihenfolge",
					"id_strecke"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_formation": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_formation_ihpt": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_formation_rcs": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_gleiskante2gleisstrang": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_gleiskante_clean": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/uno_h_gleiskante_clean/data/",
			"table": {
				"name": "uno_h_gleiskante_clean"
			},
			"type": "HiveTableDataObject"
		},
		"stg_gleiskante_gtgstrang_mapping": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"neid_gtgstrang",
					"id_gleiskante",
					"gueltig_ab"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_gleiskante_plus": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/uno_h_gleiskante_plus/data/",
			"table": {
				"name": "uno_h_gleiskante_plus"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_gleisknoten_clean": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/uno_h_gleisknoten_clean/data/",
			"table": {
				"name": "uno_h_gleisknoten_clean"
			},
			"type": "HiveTableDataObject"
		},
		"stg_gleispunkt_clean": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/uno_h_gleispunkt_clean/data/",
			"table": {
				"name": "uno_gleispunkt_clean"
			},
			"type": "HiveTableDataObject"
		},
		"stg_gtg2gleisstrang": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"neid_gtgstrang",
					"id_gleisstrang",
					"gueltig_ab"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_gtg2strecke": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"neid_gtgstrang",
					"strecke_gtgposition_von",
					"gueltig_ab"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_gtg2strecke_pre": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"neid_gtgstrang",
					"strecke_gtgposition_von",
					"gueltig_ab"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_gtgstrang": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"neid_gtgstrang"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_mag_ignorandum": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"id_mitte_ag"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_mag_strecke": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"id_mitte_ag",
					"gueltig_ab",
					"id_gleiskante",
					"neid_gtgstrang",
					"strecke_gtgposition_von"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_positionspunkt": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					},
					{
						"aclType": "user",
						"name": "impala",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"zoom"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_positionspunkt_dinar_dgp_plus": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/dinar_gtgstrang_dgp_plus/data/",
			"table": {
				"name": "dinar_gtgstrang_dgp_plus"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_positionspunkt_gleiskante": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					},
					{
						"aclType": "user",
						"name": "impala",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"zoom"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_positionspunkt_gtgstrang": {
			"acl": {
				"acls": [
					{
						"aclType": "group",
						"name": "dl_sec_bd_lab_anabel",
						"permission": "r-x"
					},
					{
						"aclType": "user",
						"name": "impala",
						"permission": "r-x"
					}
				],
				"permission": "rwxr-x---t"
			},
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"zoom"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_stammdaten_gefahrgut_bezeichnungen": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"UN_Nr"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_stammdaten_gefahrgut_gefahrgutklassen": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"schemaMin": "un_nr STRING,gefahrgutklasse DOUBLE,gueltig_ab TIMESTAMP,gueltig_bis TIMESTAMP",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"UN_Nr"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_stammdaten_gefahrgut_leitstoff": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"schemaMin": "un_nr STRING,leitstoff_umweltrisiken_nr INT,leitstoff_umweltrisiken_bezeichnung STRING,gewichtungsfaktor_umweltrisiken DOUBLE,leitstoff_personenrisiken_nr INT,leitstoff_personenrisiken_bezeichnung STRING,gewichtungsfaktor_personenrisiken DOUBLE,gwk STRING,gueltig_ab TIMESTAMP,gueltig_bis TIMESTAMP",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"un_nr"
				]
			},
			"type": "TickTockHiveTableDataObject"
		},
		"stg_stammdaten_zugkategorie": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/stammdaten/zugkategorien/data/",
			"table": {
				"name": "git_stammdaten_zugkategorie"
			},
			"type": "HiveTableDataObject"
		},
		"stg_strecke_gleis_bezug": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"id_gleisstrang",
					"gs_position_von",
					"gueltig_ab"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_strecken_dfa": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_streckenkombination": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_zuglauf": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_zuglauf_ignorandum": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"stg_zuglauf_strecke": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"reihenfolge"
				]
			},
			"type": "HiveTableDataObject"
		},
		"stg_zuglauf_strecke_wegfilter": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}",
				"primary-key": [
					"dt",
					"id_zug",
					"reihenfolge"
				]
			},
			"type": "HiveTableDataObject"
		},
		"uno_betriebspunkt": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_betriebspunkt"
			},
			"type": "HiveTableDataObject"
		},
		"uno_gleiskante": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_gleiskante"
			},
			"type": "HiveTableDataObject"
		},
		"uno_gleisknoten": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_gleisknoten"
			},
			"type": "HiveTableDataObject"
		},
		"uno_gleispunkt": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_gleispunkt"
			},
			"type": "HiveTableDataObject"
		},
		"uno_mitte_ag": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_mitte_ag"
			},
			"type": "HiveTableDataObject"
		},
		"uno_signal": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_signal"
			},
			"type": "HiveTableDataObject"
		},
		"uno_weichengrenze": {
			"table": {
				"db": "app_datalake",
				"name": "btl_uno_h_weichengrenze"
			},
			"type": "HiveTableDataObject"
		}
	},
	"default": {
		"acl": {
			"acls": [
				{
					"aclType": "group",
					"name": "dl_sec_bd_lab_anabel",
					"permission": "r-x"
				}
			],
			"permission": "rwxr-x---t"
		},
		"actionBewegungsdatenInit": {
			"executionMode": {
				"alternativeOutputId": "atl_zuglauf_strecke",
				"failCondition": "(size(selectedInputPartitionValues) = 0)",
				"type": "PartitionDiffMode"
			},
			"type": "CustomSparkAction"
		},
		"actionCustomSparkActionGeneral": {
			"breakDataFrameLineage": true,
			"executionMode": {
				"type": "FailIfNoPartitionValuesMode"
			},
			"type": "CustomSparkAction"
		},
		"actionStammdatenGeneral": {
			"breakDataFrameLineage": true,
			"type": "CustomSparkAction"
		},
		"hiveRcsTableDtPartitioned": {
			"expectedPartitionsCondition": "elements['dt'] not in ('20121027','20130328','20131026','20160424','20160425','20160426','20160520','20160521','20160522','20160523')",
			"partitions": [
				"dt"
			],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"hiveTable": {
			"partitions": [],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"hiveTableDtPartitioned": {
			"partitions": [
				"dt"
			],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"options": {
			"dts": "20210127",
			"require-partitions-existing": true
		},
		"outputAtl": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"outputAtlTickTock": {
			"connectionId": "anabelAtlLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"outputGeneric": {
			"connectionId": "anabelGenericLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"outputNeig": {
			"connectionId": "anabelNeigLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"outputRep": {
			"connectionId": "anabelRepLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [],
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"outputStage": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"partitions": [
				"dt"
			],
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"outputStageStammdaten": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "HiveTableDataObject"
		},
		"outputStageStammdatenTickTock": {
			"connectionId": "anabelStageLayerConnection",
			"numInitialHdfsPartitions": -1,
			"path": "/~{id}/data/",
			"table": {
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		},
		"tickTockHiveTableDtPartitioned": {
			"partitions": [
				"dt"
			],
			"table": {
				"db": "lab_anabel",
				"name": "~{id}"
			},
			"type": "TickTockHiveTableDataObject"
		}
	},
	"env": {
		"SDLRAW_ATL_EXECUTION_MODE": {
			"type": "FailIfNoPartitionValuesMode"
		},
		"SDL_APP": "anabel",
		"SDL_APP_OR_LAB": "lab",
		"SDL_AUTHORIZATION_HEADER": "Basic",
		"SDL_COLLECT_METRICS": false,
		"SDL_DTS": "20210127",
		"SDL_HDFS_HOME_PATH": "hdfs://nameservice1/user/fbd_lab_anabel",
		"SDL_HDFS_NAMESERVICE": "nameservice1",
		"SDL_HDFS_TMP_PATH": "/tmp/fbd_lab_anabel",
		"SDL_HIVE_DB": "lab_anabel",
		"SDL_JDBC_CONNECTSTRING": "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=porasbbselscan.sbb.ch)(PORT=1551))(CONNECT_DATA=(SERVICE_NAME=GS_ANABEL_ENTW)))",
		"SDL_JDBC_PW": "changeme",
		"SDL_JDBC_USER": "GSU_ANABEL",
		"SDL_LOADDATE": 20210127,
		"SDL_NEIG_TARGET_DB": "lab_anabel",
		"SDL_SBB_ENV": "Prod",
		"SDL_SOURCE": "anabel",
		"SDL_SPARK_MAX_EXECUTORS": 5,
		"SDL_SPARK_SHUFFLE_PARTITIONS": 100,
		"SDL_STAMMDATEN_GIT_URL": "https://code.sbb.ch/projects/KD_BIGDATA/repos/anabel/raw/",
		"SDL_TEST_PREFIX": "_"
	},
	"global": {
		"sparkOptions": {
			"hive.exec.dynamic.partition": true,
			"hive.exec.dynamic.partition.mode": "nonstrict",
			"hive.exec.max.dynamic.partitions": 10000,
			"spark.checkpoint.compress": true,
			"spark.debug.maxToStringFields": 1000,
			"spark.rdd.compress": true,
			"spark.shuffle.service.enabled": true,
			"spark.sql.broadcastTimeout": 400,
			"spark.sql.parquet.writeLegacyFormat": true,
			"spark.sql.shuffle.partitions": 100,
			"spark.sql.sources.partitionOverwriteMode": "dynamic"
		}
	},
	"shared": {
		"aclImpala": {
			"acls": [
				{
					"aclType": "group",
					"name": "dl_sec_bd_lab_anabel",
					"permission": "r-x"
				},
				{
					"aclType": "user",
					"name": "impala",
					"permission": "r-x"
				}
			],
			"permission": "rwxr-x---t"
		},
		"application": "anabel",
		"dataframe-options": {
			"cacheable": true
		},
		"db": "lab_anabel",
		"dfagis-db": "app_datalake",
		"dgp-db": "app_datalake",
		"diamond-db": "app_diamond",
		"dinar-db": "app_datalake",
		"dts": "20210127",
		"fos-db": "app_datalake",
		"git-authentication": "Basic RlM0NTQwNjpNakEwTXpJek56QTNOamMwT3FSQTJkd0UvN0NhRFpBdDBqQjM2aTZCRkhudA==",
		"hdfs-home-path": "hdfs://nameservice1/user/fbd_lab_anabel",
		"hdfs-nameservice": "nameservice1",
		"hdfs-tmp-path": "/tmp/fbd_lab_anabel",
		"hive-db": "lab_anabel",
		"loaddate": 20210127,
		"neig-target-db": "lab_anabel",
		"rcsarchiv-db": "app_datalake",
		"sbb-env": "Prod",
		"source": "anabel",
		"uno-db": "app_datalake"
	}
}