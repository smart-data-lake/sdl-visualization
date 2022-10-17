/**Separate file to configure the attributes that are to be displayed at the top of the
 * configuraton overiew. Nested attributes can be called using a dot. */


const commonAtts: string[] = ['type', 
                            'metadata.name', 
                            'name'];

const dataObjectsAtts: string[] = ['path', 
                                'table.db', 
                                'table.name', 
                                'table.primaryKey', 
                                'partitions', 
                                'metadata.layer', 
                                'metadata.subjectArea'];

const actionsAtts: string[] = [];

const connectionsAtts: string[] = ['db', 
                                'pathPrefix',
                                'path-prefix',
                                'database',
                                'port',
                                'host',
                                'url'];

export const TOP_ATTRIBUTES = [...commonAtts, ...dataObjectsAtts, ...actionsAtts, ...connectionsAtts];


