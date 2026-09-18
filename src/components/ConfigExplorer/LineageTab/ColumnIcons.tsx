import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import './ColumnIcons.css';

/*
    The symbols a column of a DataObject is marked with: a key for a primary key, a link for a
    foreign key, a broken link for one pointing outside the configuration.

    They live in their own module, next to their own stylesheet, because two views mark the same
    thing and have to mark it the same way: the columns of a graph node (DataObjectColumns) and the
    Schema tab's table. LineageTab.css would be the obvious place for the rules, but it also holds
    overrides of ReactFlow's stylesheet that only win because they are injected after it - so
    importing it from outside the lineage tab moves it up the module graph and silently breaks
    those. Nothing here overrides anything, so this file can be imported from anywhere.
*/

/** A primary key column. */
export function PrimaryKeyIcon() {
    return <KeyIcon className="lineage-column-icon lineage-column-icon-pk" titleAccess="primary key"/>;
}

/** A column referencing another DataObject of this configuration. */
export function ForeignKeyIcon() {
    return <LinkIcon className="lineage-column-icon lineage-column-icon-fk" titleAccess="foreign key"/>;
}

/** A column whose every foreign key points at a DataObject this configuration does not describe. */
export function UnresolvedForeignKeyIcon() {
    return <LinkOffIcon className="lineage-column-icon lineage-column-icon-unresolved"
                        titleAccess="foreign key pointing outside this configuration"/>;
}
