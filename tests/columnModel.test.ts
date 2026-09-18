/**
 * The column model of a DataObject: what the configuration declares about its keys, merged with
 * the schema the DataObjectSchemaExporter wrote.
 */
import { describe, expect, test } from 'vitest';
import {
  buildColumnModel,
  filterColumns,
  getExportedColumns,
  getForeignKeys,
  getPrimaryKey,
  lessColumns,
  moreColumns,
} from '../src/util/ConfigExplorer/ColumnModel.ts';
import { SchemaData } from '../src/types.ts';

const intDepartures = {
  type: 'DeltaLakeTableDataObject',
  table: {
    db: 'default',
    name: 'int_departures',
    primaryKey: ['icao24', 'estdepartureairport', 'dt'],
    foreignKeys: [
      { name: 'fk_departure_airport', dataObjectId: 'int-airports', columns: { estdepartureairport: 'ident' } },
      { name: 'fk_arrival_airport', dataObjectId: 'int-airports', columns: { estarrivalairport: 'ident' } },
    ],
  },
  _columnDescriptions: { icao24: 'the transponder address' },
};

const schema: SchemaData = {
  schema: [
    { name: 'icao24', dataType: 'string', nullable: false },
    { name: 'estdepartureairport', dataType: 'string' },
    { name: 'estarrivalairport', dataType: 'string' },
    { name: 'firstseen', dataType: 'bigint' },
    { name: 'route', dataType: { dataType: 'struct', fields: [{ name: 'from', dataType: 'string' }] } },
  ],
};

const byName = (columns: any[], name: string) => columns.find((c) => c.name === name)!;

describe('reading the configuration', () => {
  test('primary key and foreign keys are read from table', () => {
    expect(getPrimaryKey(intDepartures)).toEqual(['icao24', 'estdepartureairport', 'dt']);
    expect(getForeignKeys(intDepartures).map((fk) => fk.name)).toEqual([
      'fk_departure_airport',
      'fk_arrival_airport',
    ]);
  });

  test('a data object without a table declares no keys', () => {
    expect(getPrimaryKey({ type: 'CsvFileDataObject' })).toEqual([]);
    expect(getForeignKeys({ type: 'CsvFileDataObject' })).toEqual([]);
  });

  test('malformed entries are ignored rather than thrown on', () => {
    const broken = { table: { primaryKey: 'ident', foreignKeys: [{ dataObjectId: 'x' }, null, { columns: {} }] } };
    expect(getPrimaryKey(broken)).toEqual([]);
    expect(getForeignKeys(broken)).toEqual([]);
  });

  test('a key in the pre 3.x db/table form is ignored', () => {
    /*
        SDLB 3.x replaced the referenced db/table by the id of the referenced data object
        (smart-data-lake#1148). An old configuration names a table, which cannot be turned into a
        data object without guessing - so the key is dropped rather than half resolved.
    */
    const legacy = {
      table: {
        name: 'int_departures',
        foreignKeys: [
          { name: 'fk_legacy', db: 'reference', table: 'airlines', columns: { callsign: 'callsign' } },
          { name: 'fk_arrival_airport', dataObjectId: 'int-airports', columns: { estarrivalairport: 'ident' } },
        ],
      },
    };
    expect(getForeignKeys(legacy).map((fk) => fk.name)).toEqual(['fk_arrival_airport']);
    // and the column the old key names does not make it into the model either
    expect(buildColumnModel(legacy).columns.map((c) => c.name)).toEqual(['estarrivalairport']);
  });
});

describe('the exported schema', () => {
  test('only the top level is taken, a nested type is named by its kind', () => {
    const columns = getExportedColumns(schema);
    expect(columns.map((c) => c.name)).toEqual([
      'icao24', 'estdepartureairport', 'estarrivalairport', 'firstseen', 'route',
    ]);
    expect(byName(columns, 'route').dataType).toBe('struct');
  });

  test('a failed export carries a message instead of columns', () => {
    expect(getExportedColumns({ info: 'AnalysisException: table not found' })).toEqual([]);
    expect(getExportedColumns(undefined)).toEqual([]);
  });
});

describe('merging', () => {
  test('without a schema the keys alone make up the model', () => {
    const { columns, source } = buildColumnModel(intDepartures);
    expect(source).toBe('keys');
    expect(columns.map((c) => c.name).sort()).toEqual(
      ['dt', 'estarrivalairport', 'estdepartureairport', 'icao24'].sort(),
    );
    // nothing to be absent from, so no column is marked as declared only
    expect(columns.every((c) => !c.declaredOnly)).toBe(true);
  });

  test('with a schema the order is the schema\'s, and key columns it misses are appended', () => {
    const { columns, source } = buildColumnModel(intDepartures, { schema });
    expect(source).toBe('merged');
    expect(columns.map((c) => c.name)).toEqual([
      'icao24', 'estdepartureairport', 'estarrivalairport', 'firstseen', 'route', 'dt',
    ]);
    // 'dt' is named by the primary key but is not in the schema - it still needs a handle
    expect(byName(columns, 'dt').declaredOnly).toBe(true);
    expect(byName(columns, 'icao24').declaredOnly).toBe(false);
  });

  test('primary and foreign keys are marked on the merged columns', () => {
    const { columns } = buildColumnModel(intDepartures, { schema });
    expect(columns.filter((c) => c.isPrimaryKey).map((c) => c.name))
      .toEqual(['icao24', 'estdepartureairport', 'dt']);
    expect(byName(columns, 'estarrivalairport').references).toEqual([
      { dataObjectId: 'int-airports', column: 'ident', fkName: 'fk_arrival_airport', resolved: false },
    ]);
    // one column can be both the primary key and a foreign key
    expect(byName(columns, 'estdepartureairport').isPrimaryKey).toBe(true);
    expect(byName(columns, 'estdepartureairport').references).toHaveLength(1);
  });

  test('key columns are matched against the schema case insensitively', () => {
    const upperCased: SchemaData = { schema: [{ name: 'Ident', dataType: 'string' }] };
    const configObj = { table: { name: 't', primaryKey: ['ident'] } };
    const { columns } = buildColumnModel(configObj, { schema: upperCased });
    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe('Ident');       // rendered as the schema spells it
    expect(columns[0].isPrimaryKey).toBe(true);
    expect(columns[0].declaredOnly).toBe(false);
  });

  test('a reference names its data object whether or not the configuration describes it', () => {
    // the reference is kept either way - the column still carries a relation - but only a data
    // object this configuration knows can be navigated to, which is what resolved says
    const { columns } = buildColumnModel(intDepartures, {
      schema,
      isKnownDataObject: (dataObjectId) => dataObjectId === 'int-airports',
    });
    expect(byName(columns, 'estarrivalairport').references[0])
      .toEqual({ dataObjectId: 'int-airports', column: 'ident', fkName: 'fk_arrival_airport', resolved: true });

    const { columns: unresolved } = buildColumnModel(intDepartures, {
      schema,
      isKnownDataObject: () => false,
    });
    expect(byName(unresolved, 'estarrivalairport').references[0].resolved).toBe(false);
  });

  test('the referenced side of a relation is part of the model too', () => {
    const intAirports = { table: { db: 'default', name: 'int_airports', primaryKey: ['ident'] } };
    const { columns } = buildColumnModel(intAirports, {
      referencedBy: [
        { column: 'ident', dataObjectId: 'int-departures', fromColumn: 'estarrivalairport', fkName: 'fk_arrival_airport' },
        { column: 'iata_code', dataObjectId: 'int-departures', fromColumn: 'code' },
      ],
    });
    expect(byName(columns, 'ident').referencedBy).toHaveLength(1);
    // a referenced column that is not a primary key still gets into the model, so that it has a handle
    expect(byName(columns, 'iata_code').referencedBy).toHaveLength(1);
    expect(byName(columns, 'iata_code').isPrimaryKey).toBe(false);
  });

  test('column descriptions are merged in', () => {
    const { columns } = buildColumnModel(intDepartures, { schema });
    expect(byName(columns, 'icao24').description).toBe('the transponder address');
    expect(byName(columns, 'firstseen').description).toBeUndefined();
  });

  test('a data object with neither keys nor a schema has no columns', () => {
    expect(buildColumnModel({ type: 'CsvFileDataObject' })).toEqual({ columns: [], source: 'none' });
  });

  test('a schema without keys is reported as exported', () => {
    expect(buildColumnModel({ type: 'CsvFileDataObject' }, { schema }).source).toBe('exported');
  });
});

describe('filtering', () => {
  const { columns } = buildColumnModel(intDepartures, { schema });

  test('none keeps nothing - the node is closed', () => {
    expect(filterColumns(columns, 'none')).toEqual([]);
  });

  test('all keeps every column', () => {
    expect(filterColumns(columns, 'all')).toHaveLength(columns.length);
  });

  test('keys keeps both sides of a relation and the primary key', () => {
    expect(filterColumns(columns, 'keys').map((c) => c.name))
      .toEqual(['icao24', 'estdepartureairport', 'estarrivalairport', 'dt']);
  });

  test('keys keeps a referenced column that is not a key of its own', () => {
    const { columns: referenced } = buildColumnModel(
      { table: { name: 'int_airports' } },
      { schema: { schema: [{ name: 'ident', dataType: 'string' }, { name: 'name', dataType: 'string' }] },
        referencedBy: [{ column: 'ident', dataObjectId: 'int-departures', fromColumn: 'estarrivalairport' }] },
    );
    expect(filterColumns(referenced, 'keys').map((c) => c.name)).toEqual(['ident']);
  });

  test('the display steps in both directions, and stops at the ends', () => {
    expect(moreColumns('none')).toBe('keys');
    expect(moreColumns('keys')).toBe('all');
    expect(moreColumns('all')).toBe('all');
    expect(lessColumns('all')).toBe('keys');
    expect(lessColumns('keys')).toBe('none');
    expect(lessColumns('none')).toBe('none');
  });
});
