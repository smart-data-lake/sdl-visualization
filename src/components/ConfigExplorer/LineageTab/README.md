# Lineage tab

The graph panel of the config explorer, and the graph tab of the run view. One component,
`LineageTabWithSeparateView.tsx`, renders four views of the same configuration; the conversion from
the domain graphs to ReactFlow lives in `src/util/ConfigExplorer/LineageTabUtils.tsx`, the domain
graphs themselves in `src/util/ConfigExplorer/Graphs.ts`.

## The four views

`GraphView` in `LineageTabUtils.tsx`, selected in the toolbar, resolved by `getGraphFromConfig`:

| view | graph | nodes | edges |
|---|---|---|---|
| `full` | `ConfigData.fullGraph` | data objects **and** actions | an action's inputs and outputs |
| `data` | `ConfigData.dataGraph` | data objects | an action, collapsed to the flow it causes |
| `action` | `ConfigData.actionGraph` | actions | the data object two actions share |
| `relations` | `ConfigData.relationsGraph` | data objects | a declared **foreign key** |

The first three describe **what flows where** and are derived from the actions. The fourth describes
**how the data relates** and is derived from `table.foreignKeys` alone — two data objects can be
related without an action connecting them, and two data objects an action connects need not be
related. It is built in `src/util/ConfigExplorer/RelationsGraph.ts`.

A foreign key names the data object it references — `dataObjectId`, since SDLB 3.x replaced the
former `db`/`table` pair ([smart-data-lake#1148](https://github.com/smart-data-lake/smart-data-lake/pull/1148)) —
so an edge is a lookup by id rather than a resolution by table name. A key still written the old way
names a table, not a data object, and is **ignored** (`getForeignKeys` in `ColumnModel.ts`): there is
no way to turn it into a data object without guessing, and a wrong relation is worse than none. A
key naming a data object this configuration does *not* describe — one filtered away by a feed
selection, say — keeps its reference and renders as unresolved.

Everything downstream of `getGraphFromConfig` — centering, expand and collapse, grouping, layout,
search, the PNG download — works on all four, because all four are a `DAGraph`. The relations graph
is the one that is **not acyclic**: foreign keys point in circles (orders reference customers,
customers reference their latest order), so the traversals in `Graphs.ts` carry a visited set.

## Columns

A data object node can show its columns, marking primary and foreign keys
(`DataObjectColumns.tsx`), which makes it read like a table of an entity relation diagram: a title,
a rule under it, one row per column, and a control along its lower border. This is a property of
the node, not of the relations view: the columns show in every view.

The control walks three displays — `none`, `keys`, `all` (`ColumnDisplay` in `ColumnModel.ts`).
Closed it is one chevron that opens the node on its key columns; open on the keys it is two, one
per direction; open on all columns only the way back is left. A step that would add nothing — a
table whose every column is a key column — is not offered, which is only decidable once the
exported schema has resolved. Key columns first because a table can have dozens of columns, and the
ones a relation runs through are what the graph is about.

The strip spans the node, but **only its two ends are clickable**. The node's own graph expand
handle is anchored in the middle of the same border — it cannot move, because that is where the
edges attach — so it is lifted above the strip and the strip's halves stop short of the middle.
A direction that is unavailable keeps its place as an empty half, so the remaining chevron does not
wander to the other end.

The columns come from two places, merged in `src/util/ConfigExplorer/ColumnModel.ts`:

- **the configuration** — `table.primaryKey` and the referencing columns of `table.foreignKeys`,
  plus the columns *other* data objects reference (`getIncomingRefs`). Synchronous, always there.
- **the exported schema** — what the `DataObjectSchemaExporter` wrote, fetched per node with
  `useFetchDataObjectSchemaEntries` / `useFetchDataObjectSchema`. There is no call that fetches
  several data objects' schemas at once; react-query caches and deduplicates them.

The merged list is the schema's columns **plus** every column a key names, matched case
insensitively (a configuration writes `primaryKey = [ident]`, a schema reports `Ident`). That union
is not cosmetic: a relation edge attaches to a column's handle, and **ReactFlow silently drops an
edge whose handle does not exist**. A column a key names but the schema does not have is marked
`declaredOnly` and rendered in italics — a column the configuration believes in and the data does
not have.

A column that takes part in a relation carries the way to its other end: its name links to that data
object, and its tooltip names every relation it takes part in, in both directions. The name is only
a link when there is **exactly one** *resolved* data object at the other end — a primary key is typically
referenced from several tables, and picking one of them would be a guess. Several relations to the
*same* data object are not ambiguous, so what is counted is distinct data objects, not relations.
A column with nothing to add to what its row already shows — a primary key and nothing else — gets
no tooltip at all, rather than one that opens on an empty box.

An edge carries the name of the foreign key it stands for as an SVG `<title>`, as the **first child
of the edge's own group**. An edge is two paths, a wide invisible one that makes it easier to hit
and the visible line drawn on top of it; a title on either of them would only show while the pointer
is over that one, so hovering the line itself would say nothing.

The control is offered only where there is something to show: a data object with neither keys nor a
schema export — a web service, say — would otherwise open on "no columns". Deciding that needs the
schema *index*, so that one small file is read for every data object node rather than only for an
open one; the schema itself is still fetched only once the columns are asked for.

Font sizes live in `DataObjectColumns.tsx` (`COLUMN_FONT_SIZE`), not in `LineageTab.css`: a Joy
`Typography` brings its own `font-size` through emotion, which is injected after the stylesheet and
wins. The line box is tied to `COLUMN_ROW_HEIGHT`, which is what the node declares its height from
before it renders.

The symbols a column is marked with are in `ColumnIcons.tsx`, with a stylesheet of their own, because
the **Schema tab marks the same keys** — a `PK` column with the same key symbol and an `FK` column of
data object chips (`SchemaTab.tsx`), offered only where the configuration declares such a key, the
`FK` one hidden until the column selection menu above the table turns it on. Their rules cannot live
in `LineageTab.css`: that file's own rules override ReactFlow's only because it is injected
after ReactFlow's stylesheet, and importing it from outside the lineage tab moves it up the module
graph and silently loses every one of those overrides — handle cursors and offsets included.

## Where the state lives

- **Toolbar settings** are React context (`useLineage.tsx`). Any change to them re-creates the whole
  flow (`reactFlowKey` in `LineageTabCore`), so per-node state cannot live there.
- **How much of its columns a node shows** is `rfNode.data.columnDisplay`, written through
  `setRfNodeData`. It has to survive re-renders, and the *edges* have to be able to read it to pick
  the handle they attach to, which rules out node-local `useState`. `rfNode.data.columns` holds
  every column; what is rendered is that list narrowed by `filterColumns`.
- The **ReactFlow instance** is not in context; components get it from `useReactFlow()` and the
  functions in `LineageTabUtils.tsx` take it as a parameter.

## Sizes and handles

The layout has to know how tall a node is **before** it is rendered, so a node *declares* its size
rather than being measured: `nodeSizeFor` computes it from the number of visible columns, ReactFlow
gets it as `style.width/height`, `dagreLayoutRf` reads it back through `rfNodeSize`, and the node's
own box fills 100% of it. The constants in `DataObjectColumns.tsx` and the row height in
`LineageTab.css` are therefore the same numbers and have to stay in step.

Every handle sits **on the node's border**, because that is where ReactFlow puts the end of the
edge: an anchor set inside the node hides the end of the line under it, one set outside leaves a gap
between the arrow head and the node. Handles are children of the node's *padded* box — and, inside
the column block, of a column row — so an offset meant to land on the outer border has to undo the
border width resp. the border plus the padding. Both distances are published as custom properties on
the node (`--lineage-node-border`, `--lineage-column-inset`), because a highlighted node has a
thicker border.

The node's horizontal padding (`NODE_PADDING_X`) is wider than `EXPAND_BUTTON_OUTSET` for the same
reason: that button reaches into the node, and a narrower padding puts the title right against it.
Its *vertical* padding stays where it was, because `NODE_HEADER_HEIGHT` is what the node declares
its height from before it renders and the title has to keep fitting inside that.

The one exception is a border that carries a **graph expand button**. That button is centred on the
border, so an edge ending there would have its arrow head behind it; every anchor on that border
moves out to the button's outer edge instead (`EXPAND_BUTTON_OUTSET`), and the button is pushed back
inwards by the same amount so that it keeps straddling the border. In the `LR` layout that border is
also where the node level *relation* handles sit, so they take the same offset.

Handles:

- the **node level** handle of a node is named after the node, and sits top/bottom in the `TB`
  layout resp. left/right in `LR`. The lineage edges use it.
- a **column** handle is `col-source:<column>` / `col-target:<column>` (`columnHandleId`), always
  left and right, positioned inside its row so the browser does the vertical arithmetic.
- a data object also carries `node-source:<id>` / `node-target:<id>` (`nodeRelationHandleId`),
  always left and right, anchored on the middle of the *title*. The relation edges use these
  instead of the layout driven one: a relation is a horizontal thing, and mixing the two
  orientations makes an edge leave a node's lower border only to swing all the way around and come
  back into the other node's left border. Anchoring on the title rather than on the node keeps an
  edge pointing at the table's name as the node grows and shrinks with its columns.
- every edge names both of its handles explicitly. ReactFlow's fallback picks the first handle of
  the right type, which stops being the node's own as soon as it has columns.

Selecting the relations view switches the layout to `LR`, the arrangement an entity relation diagram
is normally drawn in: the node level relation handles are then on the same two borders the layout
itself runs along. The layout button still switches it back.

In `LR` the *layout driven* handles are on those borders too, and would otherwise sit at the
vertical middle of the node — which for a node showing its columns is somewhere among the rows. They
are anchored on the middle of the title instead, which is where they already are for a node without
columns.

A relation is one ReactFlow edge **per column pair**. While both of its ends are closed the pairs of
a foreign key share the two node level handles and draw on top of each other — one line between two
data objects — and they move apart onto their columns as a node is opened
(`updateRelationEdgeHandles`). The two ends are decided separately, so opening one of two related
data objects gives an edge from a column to a node. Which columns a relation runs through is read
off the rows themselves and from the tooltip of a column, not from a label on the edge.

Two rules that are easy to break:

1. **Toggling columns and re-pointing the edges must happen in the same synchronous block**, or the
   edges are dropped in between.
2. **Every change to the columns or to the expansion state must be followed by
   `useUpdateNodeInternals()`**, or ReactFlow keeps the old handle geometry and the edges point into
   empty space.

## Fixtures

Nothing in the getting-started project declares a foreign key, so the relations view would have
nothing to show. `tests/e2e/fixtures/hocon/config/relations.conf` and
`tests/e2e/fixtures/patch-relations.py` add the same keys to both config sources; the latter is run
by `update-fixtures.sh`, because the exported config is downloaded whole and would otherwise lose
them on the next refresh. `public/config/exampleFile.conf` has the same keys for local development.
