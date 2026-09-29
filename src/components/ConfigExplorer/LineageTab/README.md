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
related. It is built in `src/util/ConfigExplorer/RelationsGraph.ts`. The view is offered even when
the configuration declares no foreign key (getting-started, for one): it then shows the selected
data object on its own, with its columns, rather than a disabled button nobody can explain.

A foreign key names the data object it references — `dataObjectId`, since SDLB 3.x replaced the
former `db`/`table` pair ([smart-data-lake#1148](https://github.com/smart-data-lake/smart-data-lake/pull/1148)) —
so an edge is a lookup by id rather than a resolution by table name. A key still written the old way
names a table, not a data object, and is **ignored** (`getForeignKeys` in `ColumnModel.ts`): there is
no way to turn it into a data object without guessing, and a wrong relation is worse than none. A
key naming a data object this configuration does *not* describe — one filtered away by a feed
selection, say — keeps its reference and renders as unresolved.

Everything downstream of `getGraphFromConfig` — centering, expand and collapse, layout, search, the
PNG download — works on all four, because all four are a `DAGraph`. Grouping works on the three
views of the flow, see *Grouping*. The relations graph
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
exported schema has resolved. A table without any key column skips the `keys` step in both
directions (`moreColumns`/`lessColumns` take `hasKeys`), as it would open on nothing. Key columns first because a table can have dozens of columns, and the
ones a relation runs through are what the graph is about.

How far a node is open is **remembered per node** (`rememberColumnDisplay`, module state in
`LineageTabUtils.tsx` for the same reason as the trace), so it survives a change of graph view or
layout and leaving the config explorer. A rebuilt data object starts at its remembered display; an
action only once its ports are known, as the data and relations views have no actions. After a rebuild
`updateColumnEdges` runs once, because a node with configured keys only loads nothing that would
otherwise move its edges onto its columns.

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

- **Toolbar settings** are React context (`useLineage.tsx`), the grouping among them. A change to one of them rebuilds the
  node set, which is handed to the live flow rather than re-creating it, so per-node state that has
  to survive that still cannot live there.
- **How much of its columns a node shows** is `rfNode.data.columnDisplay`, written through
  `setRfNodeData`. It has to survive re-renders, and the *edges* have to be able to read it to pick
  the handle they attach to, which rules out node-local `useState`. `rfNode.data.columns` holds
  every column; what is rendered is that list narrowed by `filterColumns`.
- **Whether a node's neighbours are shown** is `rfNode.data.isExpandedForward` / `isExpandedBackward`,
  for the same reason: a node is expanded by its own handles *and* by selecting it, and the handles
  have to show what is actually there. Undefined means "as the node was created".
- **Which element is selected** is `rfNode.data.isSelectedElement`, and it is deliberately *not*
  `graphNodeProps.isCenterNode`. The center node is the one the current node set was built around,
  which decides which expand handles start out open; the selected element is what the config
  explorer is showing and only decides the highlight.
- The **ReactFlow instance** is not in context; components get it from `useReactFlow()` and the
  functions in `LineageTabUtils.tsx` take it as a parameter.

## Layout stability

The graph used to be laid out from scratch on every interaction - every selection, every expand
handle, every column toggle - which reordered the nodes and moved the ones that had not changed.
dagre is deterministic for a given insertion order but sensitive to it, and the node array order was
the only ordering input it got: it changed with every `concat`, every `Array.from(new Set(...))` and
every sort. The same graph therefore came out differently depending on which node the user had
clicked last.

The layout is now a **(rank, order) per node**, computed once per graph and direction and kept
(`LineageLayout.ts`). `buildLayoutModel` lays the **whole** graph of the view out with dagre, at one
size for every node, with its nodes and edges **sorted** first - so the model is a function of the
graph, not of the traversal that produced a node list. `rank` is the node's layer, `order` its place
along the other axis. `layoutModelOf` caches it per `DAGraph` instance, which is stable per
`ConfigData`; a `WeakMap` at module level rather than context, because every node of the graph reads
the context and rebuilding the model must not re-render all of them.

`createReactFlowNodes` stamps that placement onto `rfNode.data.placement`, so laying out again needs
nothing but the current content of the instance. `assignCoordinates` is then a pure function of
(placement, declared sizes, which nodes are shown): it groups by rank, sorts by order, drops empty
ranks, packs each axis and translates the result so that an **anchor** node - the one the user just
acted on - keeps the position it came in with. Nothing minimises crossings any more, so **no node
can change its order because another one appeared, grew or was selected**. What can still change is
spacing: a rank that gains a node, or whose node grows its columns, pushes its neighbours apart.

Packing a rank and centring it is only the starting point. `alignWithNeighbours` then sweeps down
and up, placing each rank as close as it can to the median of its neighbours in the rank before resp.
after it - the barycentre pass of a layered layout, except that the **order is fixed** and only the
gaps are solved for. Without it a rank holding one node is centred on the whole graph, so a node
with a single successor hangs in the middle instead of sitting over the node it feeds. Because the
order is a constraint, the placement is exact rather than heuristic: subtracting the space taken by
the nodes before it turns "keep a gap of `nodesep`" into "must not decrease", which pooling adjacent
violators solves in one pass (`placeInOrder`).

What that buys, per interaction:

| interaction | what moves |
|---|---|
| selecting an element | nothing is re-laid out; it is highlighted, its neighbours are shown, the expand handles turn to face away from it, and the view pans to it only if it is off screen |
| an element that is not shown | it is spliced in with the shortest chain connecting it to what is (`DAGraph.shortestPathToAny`), everything else stays |
| `+` expand handle | the new nodes arrive at their own slots, anchored on the node that was expanded |
| `-` collapse handle | nothing at all - taking nodes away leaves the rest where it is |
| opening a node's columns | anchored on that node, so the graph opens around it |
| dragging a node | it keeps that displacement through every later layout, see below |
| switching view, direction or the expand-all toggle | a new node set, laid out from its model |

`LineageTabCore` therefore no longer re-creates the `<ReactFlow>`. A selection is an effect that
highlights, splices or expands against the live instance; it rebuilds the node set only where this
graph view cannot reach the element at all - which is also how the "switch to a view that has this
element" navigation still works. A rebuilt node set is handed over with `setNodes`/`setEdges`; only
the first one goes through `defaultNodes`, at mount.

The memo that builds the node set must **not** watch `props`. The config explorer hands the panel a
new `flowProps` object on every navigation (`ElementDetails`), so watching it rebuilds the graph on
every selection and throws away everything the previous selections grew - the bug looks like a node
that arrived with one selection disappearing on the next. It watches the toolbar settings, the
fields of `props` that decide *what* the graph is, and `builtAround`, the element the current set was
built around; it *reads* `props.elementName`, so a rebuild that does happen for another reason is
centred on whatever is selected at that moment.

**A node the user drags keeps its place.** What is remembered is the *displacement* from where the
layout puts the node (`rfNode.data.manualOffset`, written by `recordManualMoves` from the distance
dragged), not the position: `assignCoordinates` adds it to the computed slot, so the node still
follows its neighbours when their rank grows or the graph makes room, instead of being left behind
in absolute coordinates. Expanding at one end of the graph therefore no longer undoes an arrangement
made at the other. The offset is applied *before* the anchoring, which compares against where nodes
actually are. A rebuild - a new graph view, direction or the expand-all toggle - creates new nodes
and so starts without offsets.

**The toolbar's *Reset layout* button** is the escape hatch: `resetLayout` closes the columns of
every node (and forgets that they were open), forgets every manual move and lays the nodes shown
out from the model again - which nodes are shown does not change. The arrangement only ever grows as the
user explores, and only they take it apart; that button is how it is reset.

`tests/lineageLayout.test.ts` pins the model and the coordinate assignment - including that the
model is invariant under permuting the graph's nodes and edges - and
`tests/e2e/lineage-stability.spec.ts` asserts the property the user actually sees: **zero order
inversions** among the nodes that are shown before and after an interaction, and the node that was
acted on not moving at all.

## Grouping

The toolbar's grouping menu puts the nodes into boxes by a metadata attribute, one per axis:

| axis | attribute | box |
|---|---|---|
| along the flow | `feed`, `subjectArea` | a lane the flow runs through - a row in `LR`, a column in `TB` |
| across the flow | `layer` | a band the flow crosses - a column in `LR`, a row in `TB` |

With both, lanes and columns cross each other as a grid. It needs the configuration behind the
nodes, so the run view does not offer it. Foreign keys are not a flow, so the layered relations view
does not group either; its force layout groups into hulls instead, see
[Hulls in the force layout](#hulls-in-the-force-layout).

**Membership** (`groupsOfGraph` in `src/util/ConfigExplorer/Grouping.ts`). SDLB puts `feed` on
actions and `layer`/`subjectArea` on data objects; the other type derives the attribute from the
full graph, whichever view is shown - a data object takes the feed of the actions writing it, an
action the layer and subject area of what it writes, in both cases only where they agree. A node
without a value stays outside the boxes.

**No subflows.** ReactFlow's subflows make a child's position relative to its parent, which would take
the coordinates away from `assignCoordinates`, and they have no notion of a collapsed parent that the
edges of its children end on. So every node keeps absolute coordinates, and a box is a node of its
own (`GroupBoxNode.tsx`) that is **derived** from its members, like the column lineage edges:
`groupFlowNodes` makes one per group with a member in the flow, and `fitGroupBoxes` sizes an open one
to enclose the members that are shown. Every layout goes through `layoutFlow`, which does both around
`assignCoordinates`. An open box is drawn under the edges (`baseZIndexOf`, which `resetNodeStyles`
and the trace keep), so its collapse button sits in the upper right corner, clear of the edges
running through the middle of the box. A click on its area does what a click on the pane does.

**Dragging a box** drags its members: `onNodeDrag` moves them by the box's step
(`moveGroupBoxMembers`, which also refits the boxes crossing it), and on release the move is recorded
on each member as a manual offset, not on the box - an open box has no place of its own, so the
next layout keeps the arrangement because its members keep theirs. A collapsed box is dragged like
any node.

**Boxes that cannot overlap.** The layout model is built per grouping (`buildGroupedModel` in
`LineageLayout.ts`, cached next to the ungrouped one) and gives every node a `lane` and a `column`:

- A column owns a contiguous run of ranks. dagre is given a boundary node between two consecutive
  columns, which every node of the one points to and which points to every node of the next, so that
  its ordering works on the ranks the columns end up with; an edge running against the column order
  makes a cycle, which dagre breaks wherever it likes, so the ranks are afterwards compacted column by
  column, which holds regardless. The columns are in the order of the median of their members'
  longest path rank from the sources (`orderColumns`) - not dagre's rank, which pulls a source up to
  its successor, so that `ext-departures` would put the extern column after staging.

  With columns but no lanes, a column only follows the columns it reads from: the boundary nodes run
  only between columns an edge connects, and `columnStarts` starts each one after those and then as
  late as the columns reading it allow. Two columns nothing connects can so share ranks - an extern
  column holding only `ext-departures`, which feeds integration, sits under staging instead of before
  it. `columnTracks` gives each column the first band of the cross axis that is free over all of its
  ranks (`NodePlacement.track`), which `assignCoordinates` treats like a lane band and `shiftLanes`
  keeps apart per box; and since dagre ordered the ranks without the tracks, `reorderByNeighbours`
  sorts each rank within its bands once down and once up by the median position of its neighbours.
  Where lanes cross the columns, the lanes are the bands: two columns may share ranks only where the
  lanes they cover do not overlap (`laneClash`, which otherwise makes the later one follow), and
  `shiftLanes` moves a lane only as far as keeps the column boxes sharing a rank apart
  (`columnBoxesApart`) - so the extern column still sits beside staging, in the lane of what it feeds.
- A lane owns a contiguous stretch of every rank: each rank is sorted by lane first. The lanes are in
  the order of the median cross position of their members.

Nodes without a value form a lane resp. column of their own, without a box, so that they cannot end
up inside another one. For columns that is one column per gap between the layers: an ungrouped node
goes after the last column whose median rank it reaches. One column of all of them would sit wherever
their median falls - with the btl data objects unlayered, after integration - and drag an unlayered
`ext-airports` along, against the flow, which dagre can only resolve by stringing the columns out
into one line. A lane box only covers the ranks from its first member to its last, though, so
an ungrouped node joins the lane most of its neighbours are in wherever its rank lies outside that
span (`assignHostLanes`): `ext-airports` is laid out in line with `download-airports` rather than in a
band of its own, which keeps its edges short. Its `groups` stay empty, so the box ignores it; only the
placement's `lane` names the host. A chain of ungrouped nodes follows over a few passes.

The bands start stacked, one lane after the other, but two lanes only have to keep apart at the ranks
both occupy - a box every rank from its first member to its last, a node outside a box only its own.
The barycentre pass pulls a node towards its neighbours in the nearest rank on either side that has
any, not only the adjacent one: with the extern column at rank 0 and staging in between,
`ext-departures` would otherwise stay in the middle of its band and hold the compute lane down. So
after the barycentre pass `shiftLanes` moves every lane as a whole towards the median of its
edges to other lanes, as far as the lanes sharing a rank with it allow: where the download box ends
before the compute box begins, `stg-airports` lines up with `historize-airports`. A box needs its
inset and half a `nodesep` to a node outside it, two boxes `groupGap` between them. `assignCoordinates` then gives every lane a band on the cross axis as wide as
its widest stretch, keeps the barycentre pass within that band (`placeInOrder` clamps to it), and
leaves room for two boxes' padding and header between bands and between ranks of different columns
(`groupGap`, per screen axis). A box reaches `GROUP_PADDING` past its members on three sides and its
header plus `GROUP_HEADER_GAP` on top (`groupInset`); a column box crossed by lanes reaches past the
lane boxes by the same amounts, so that its header sits above theirs where they cross.

**Collapsing.** A collapsed box hides its members (`hidden`, so that their columns, drag offsets and
expansion counts survive) and becomes a node with a place of its own: the last rank of its
members, their lane resp. column, and in the other axis the one most of them share. The last rank is
where the flow leaves the box, so a node of another lane feeding the same successors - `ext-departures`
beside a collapsed download box, both read by compute - stands next to it instead of on its outgoing
edge; the ranks its hidden members leave empty are compacted away, so its incoming edges do not
lengthen. For a column, which owns its ranks, any of them would do. Which boxes are
collapsed is module state (`setGroupCollapsed`), so it survives a rebuild. `groupFlowEdges` gives the
flow edges with an end inside a collapsed box to the box instead, merged per pair of ends and labelled
with how many they stand for (`CustomEdgeProps.groupCount`); edges within the box disappear. The
edges of the hidden members stay in the flow, which draws no edge of a hidden node, so the expansion
bookkeeping still counts them - it skips the box edges the way it skips column lineage edges. Where
a node is hidden in both a collapsed lane and a collapsed column, the lane stands for it.

Collapsing and expanding anchor on the box: a collapsed box comes in where its open one was, and an
expanded one has no placement to anchor on, so `layoutFlow` moves the result to keep it in place.
Selecting an element inside a collapsed box - from the configuration, the node search or a trace -
opens the box first (`revealGroupMember`).

`tests/lineageGrouping.test.ts` covers membership, the model, the boxes and their edges,
`tests/e2e/lineage-grouping.spec.ts` the rendering.

### Hulls in the force layout

The force layout of the relations view has no lanes or columns, so it groups by **one** attribute
(`singleGrouping`: the one along the flow before `layer`; the menu offers a single list there and
choosing an attribute replaces the other) and draws each group as a convex hull around its members
instead of a box. Nodes without a value stay free, outside every hull. The priorities are, in this
order: groups tight, hulls apart, relations short.

**The model** (`buildForceModel`, cached per grouping key like the layered one). On top of the
ungrouped forces a *cluster* force pulls every member towards its group's centroid, and a
*separation* force treats each group as a circle around that centroid and pushes overlapping circles
apart as a whole, and free nodes out of every circle. A link leaving a group pulls with
`FORCE_INTERGROUP_LINK_STRENGTH` of the usual strength, so that relations between groups do not drag
them into each other. Nodes start sorted by group, so d3's initial spiral already starts each group
in one piece.

**The guarantee** is in `assignForceCoordinates`, because circles only approximate the hulls and the
nodes grow when their columns open: it alternates `separateBoxes` (single nodes, with their real
sizes) with `separateHulls`, which moves whole groups apart by the separating axis of their hull
polygons (`separation` in `src/util/ConfigExplorer/Hull.ts`) until `HULL_GAP` is kept, and moves free
nodes out of hulls. The group holding the anchor does not move.

**The hull** (`fitGroupBoxes`, `hullOfRects`) is the convex hull of the members' rectangles, each
widened by `HULL_INSET` - a box's inset, header on top of every member, so the highest member leaves a
flat top edge the header sits on. It is stored on the box data in flow coordinates, the box node takes
its bounds, and `GroupBoxNode` draws it as a rounded SVG path. The node itself does not take the
pointer (`lineage-hull-box` in `LineageTab.css`), only the drawn path and the header do, so the empty
corners of its bounds stay part of the pane. The path is drawn relative to the hull's own bounds,
so it moves with the node while a drag is under way; the header keeps clear of the rounded corners
(`HULL_CORNER`). Collapsed, a group is a node in the middle of the hull its members make, their
moves included (`collapsedForceCentreOf`); collapsing forgets where the group node was dragged
before, and anchors on a node outside the group, since the hull collapses onto its middle rather
than onto its corner, and `groupFlowEdges`
merges the relations of its members onto it, ending on the other data object's relation handle. In
a force layout those edges are `straight`: `CustomEdge` draws them centre to centre, cut at both
nodes' borders (`useFloatingEnds`), as a force layout has no side for them to leave from. `tests/forceGrouping.test.ts` checks that no two hulls overlap and no free
node is inside one, also with grown nodes.

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

An **expand handle only carries a button on the side that can extend the graph**, and that side is
the one facing *away from the selected element*: `expandSidesFrom` (`Graphs.ts`) walks the shown
edges breadth first from the selection, and the last step of a node's shortest path says which of
its sides faces outwards - a node reached by following an edge forwards can only lead further
forwards. The selected node itself faces both ways; so does a node no path reaches, and a source or
a sink never has a button on the side where the graph ends. The result is written onto
`rfNode.data.expandSides` by `applyExpandSides` (when a node set is built) resp. `updateExpandSides`
(when the selection or the shown nodes change), because the node itself cannot see the graph.

One trap: **a node's expand handler carries the `flowProps` of the moment the node was created**
(`makeExpandNodeFunc`), so its `props.elementName` is whatever was selected back then. Anything in
`expandNodeFunc` that acts on the *current* selection - the sides, and the highlight of the nodes it
creates - has to ask the flow instead, through `selectedNodeId`.

This used to be decided at node creation from `isCenterNodeDescendant` / `isCenterNodeAncestor` -
reachability from the node the set was built around. That only held while every selection rebuilt
the graph around itself: once the graph grows, those flags describe a centre the user has long left,
and the node the graph started from kept a button pointing back into what was already shown.

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
itself runs along. The layout menu still switches it back.

### Force layout of the relations view

The layout menu offers a third choice, `force`, in the relations view only, and it is that view's
default. The relations view keeps a layout choice of its own (`layoutOf(view)`/`setLayout(view, …)`
in `useLineage.tsx`), so switching views brings each back in the layout last chosen for it; the
flows share the other, which the manifest's `lineageLayout` starts. Foreign keys are not a flow and
point in circles, so ranks put related tables far apart; a force directed placement keeps them
together. It is **static**, not a running simulation, so everything under
*Layout stability* still holds:

- `forceModelOf` (`LineageLayout.ts`) runs d3-force once per graph, synchronously and from sorted
  input with a seeded random source, so a node's place is a function of the graph alone. Like
  `layoutModelOf` it is cached per `DAGraph`.
- `createReactFlowNodes` stamps the node's centre onto `rfNode.data.forceCentre`, next to
  `placement`. `assignCoordinates` takes the force path whenever a node carries one, so none of its
  call sites needs to know the mode, and nodes added by expanding or splicing follow the mode of the
  flow they join (`flowLayoutMode`).
- The model is built at the reference size, so `assignCoordinates` then pushes apart what overlaps
  at the nodes' declared sizes, leaving the anchor where it is. Drag offsets apply as before.
- A relation leaves and enters on a left or right border, so a *side by side* force levels the two
  ends of every relation and keeps them at least a node width apart horizontally
  (`FORCE_LEVEL_STRENGTH`, `FORCE_SIDE_BY_SIDE_STRENGTH`); stacked, the edge would leave at an angle
  of more than 90°. A relation between two groups moves the groups as a whole, its push shared among
  all of the group's relations to others, since the cluster force would pull a single member back.
  And a node grows downwards from its header rather than around its centre when it opens its
  columns: the key columns come first, so the rows most relations end on stay level with their other
  end. On the dense synthetic graph of `tests/forceGrouping.test.ts` it raises the share
  of relations running closer to horizontal than vertical from about half to three quarters. The
  strengths are tuned by hand; much stronger and the simulation no longer settles.
- **Re-run** (`rerunForceLayout`, the split button next to *Reset layout*): simulates again on what
  the flow shows now (`forceModelOfFlow`) - a collapsed group as one node, its members left out, only
  the nodes expanded so far. A click keeps the **moved nodes** (those with a manual offset, so a
  dragged hull pins all its members) where they are: they are pinned (`fx`/`fy`) at where they are
  shown (`shownForceCentreOf`), and the others start from the fresh layout of what is shown, moved so
  that one node stays put - the first moved node, else the centre node, else the first by id - at a
  lower alpha, the pull holding the components together centred there. They deliberately do not
  start from where they are shown: that fed each result into the next click, which kept changing
  the layout for a dozen clicks and, with the one sided pushes of the final pass, let it drift. So a
  re-run depends only on what is shown and where the moved nodes are, and repeating it changes
  nothing. A re-run also simulates the nodes at the size they are shown (`rectCollideForce`, which
  keeps rectangles apart rather than circles, and pushes related ones apart sideways): the model of
  the whole graph lays out closed nodes, and once they open their columns the final pass separates
  them along the axis they overlap less on, which for tall nodes is vertical and steepens their
  relations. The arrow offers *Re-run from scratch*, which forgets the moves. A
  collapsed group's hidden members move by the group's step, as its place is their mean centre. The
  result lives on the nodes, so a toolbar change that rebuilds the flow goes back to the model of the
  whole graph.
- The final pass never pushes a moved node aside: `separateBoxes` and `separateHulls` treat it like
  the anchor, the other side gives way, and where both sides are pinned the overlap stays, as the
  user put them there.

In a force layout a node may lie left of the node it references. The relation handles stay on the
left and right borders, so when the target lies to the left `CustomEdge` moves both ends of a
relation edge onto the borders that face each other: every relation handle has a twin of the other
kind on the opposite border, in the same row (`col-source:x` / `col-target:x`), and the end takes
that twin's real position (`useOppositeHandle`). Mirroring about the centre instead would carry the
expand button's outset over to a border that has no button, leaving a gap there.

In `LR` the *layout driven* handles are on those borders too, and would otherwise sit at the
vertical middle of the node — which for a node showing its columns is somewhere among the rows. They
are anchored on the middle of the title instead, which is where they already are for a node without
columns.

A relation is one ReactFlow edge **per column pair**. While both of its ends are closed the pairs of
a foreign key share the two node level handles and draw on top of each other — one line between two
data objects — and they move apart onto their columns as a node is opened
(`updateColumnEdgeHandles`). The two ends are decided separately, so opening one of two related
data objects gives an edge from a column to a node. Which columns a relation runs through is read
off the rows themselves and from the tooltip of a column, not from a label on the edge.

A relation edge is drawn **straight**, in entity relation notation: no arrow head, and a crow's foot
on the referencing (many) side, i.e. at the edge's source. The foot's toes meet the node border and
its heel is where the straight line starts (`relationPaths` in `LineageGraphComponents.tsx`). The
foot is a path of its own class, not `react-flow__edge-path`, so an edge still has exactly one of
those. A data object referencing itself cannot be joined by a straight line and keeps its steps.

Two rules that are easy to break:

1. **Toggling columns and re-pointing the edges must happen in the same synchronous block**, or the
   edges are dropped in between.
2. **Every change to the columns or to the expansion state must be followed by
   `useUpdateNodeInternals()`**, or ReactFlow keeps the old handle geometry and the edges point into
   empty space.

A third, about the edge set itself: **edges are merged by id, and an edge whose ends are not both
shown is dropped**. Expanding a node adds the edges of its neighbours, and a neighbour can already
be shown - merging those with `new Set([...eds, ...rfEdges])` compares object identity, so the same
edge went in twice, and ReactFlow draws the copy into empty space, as an arrow head with no node at
it. `dfsRemoveRfElems` can leave a real one behind too: it only removes the edges it walked, so an
edge that reached a removed node from another branch stays. `dropDanglingEdges` is the invariant,
and `tests/e2e/lineage-stability.spec.ts` asserts that every rendered edge starts and ends on a
node.

## Column lineage

The data view draws SDLB's exported column lineage (issue #141, `src/util/ConfigExplorer/columnLineage.ts`)
onto the columns. Every data object node of that view reads its own lineage document
(`useFetchDataObjectLineage`), stores it as `data.columnLineage` and merges the columns it names
into its column model, flagged `declaredOnly` where an exported schema lacks them - so a data object
whose schema export failed still shows what its lineage knows. The row tooltip says per action how
the column is created.

The edges are derived, not kept: `columnLineageEdges` looks at every data flow edge one of whose ends
shows its columns and takes the column pairs from the lineage of its **target**. A pair produced by
several actions is one edge naming all of them, and a pair neither of whose columns is shown is left
out - it would only draw the data flow edge again. Where a pair is left, the data flow edge is hidden
and one edge per pair takes its place; closing both nodes brings it back. `updateColumnEdges` does
that and then points both kinds of column edge at their handles, so it replaces
`updateRelationEdgeHandles` at every place that called it. An end whose column is not **shown** - not
merely an end whose node is open - stays on the node's layout driven handle, because at the key
step most lineage columns are hidden.

Three things that are easy to break:

- A column lineage edge runs beside a data flow edge, it is **not an edge of the graph**. The
  expansion bookkeeping (`dfsRemoveRfElems`) and the layout (`alignWithNeighbours`) skip it through
  `isColumnLineageEdge`; counting it would corrupt the active edge counts and move nodes.
- Every column row carries both handles, not only a key's, because a lineage edge can end on any
  column.
- The hover text is an SVG `<title>`, first child of the edge's group, like the foreign key name.
  It names what the columns it connects do not show (`columnLineageTitle`): in the data view the
  action and its transformation per line, on a port edge of the full view only the two nodes.

### The ports of an action (full and action views)

In the full and action views an action opens, in one step, on its **ports**: the columns it reads on the left,
grouped under their data objects, the columns it writes on the right, and a curve per input column
feeding an output column in between - dashed where the column is transformed, solid where it is
taken over. The ports come from the lineage of the data objects the action *writes*
(`useFetchNewestLineageOf`, `buildActionPorts` in `src/util/ConfigExplorer/ActionPorts.ts`), since
SDLB exports lineage per output; an action without any offers nothing to open. Hovering a curve
tells only the transformation (or `unchanged`), hovering a port the column and, for an output, the expression creating it.

The ports are ordered so that the edges to the data objects cross as little as possible: the groups
follow the cross axis order of their data object nodes in the layout (`data.placement`; in the action
view, where the data objects are edges, the order of the actions at their other end - the writer of an
input, the first reader of an output - taken from the whole graph's layout model, `portGroupRanks`), and the ports within a group follow the
data object's exported schema - the order its node lists its columns in (`useFetchNewestSchemaOf`,
`PortOrder`). Columns the schema does not list go last, as they do on the data object node. The
schemas are fetched by the action itself, so the order does not change when a neighbour is opened.

`columnLineageEdges` gives the full view one edge per column the action reads resp. writes, as soon
as the port or the column at the other end is shown, from the column of the data object to the
port - `sourcePort`/`targetPort` on the edge name the port, `portHandleId` its handle. Data objects
read their own lineage in the full view too, so that the columns the ports attach to exist.

In the action view an edge stands for the data object two actions share (`CustomEdgeProps.dataObjectId`),
and it makes way for one edge per column of it, from the writer's output port to the reader's input
port - `dataObjectId` on the column edge names the data object, as neither end shows it. With both
actions open only the columns both have a port for are drawn, since the other ones have nothing to end
on; with one open, all of its columns, ending on the closed one's node. The hover text names the
column and the two actions. The action keeps its output lineage as `data.outputLineage`, so that a
trace without a built index knows what the action view shows (`traceIndex`, which counts a document
held by a data object and an action once).
The trace lights up the port edges and the curves inside the action it runs through
(`data.tracedConnections`).

### Tracing a column

In the full and data views, a click on the name of a row with lineage traces it, and in the full and
action views so does a click on the name of a port; in the relations view the name leads along the
relation instead. The tooltip only adds the full name where it is truncated,
whether the column is missing from the exported schema or unresolved in the column
lineage, and "trace column" resp. the referenced data object. The click sets `tracedColumn` in `useLineageGraph()`,
and `LineageTabCore` traces that column both ways through the **index**
(`useFetchColumnLineageIndex`, `buildGraphTrace`) - the documents of the nodes shown would only
reach as far as the graph does. Without a built index it falls back to exactly those documents
(`traceIndex`), and the panel under the graph says so.

`traceHighlights` decides what lights up, and only what the trace actually runs along: a column
edge by its column pair; in the data view a flow edge carrying a traced pair; in the full view the
edges of the actions reading or writing a traced column; in the action view an edge whose data
object has a traced column written by the one action and read by the other, resp. a column edge whose
column is - checked only at the ends that have a port. An action on the trace lights up even where
none of its edges is shown. A relation never.
The rows on the trace are the node's `data.tracedColumns`. The panel (`ColumnTracePanel`) lists
the columns the whole trace begins and ends with (`traceEnds`), and its "Show all" splices in
(`spliceNodePath`) what the graph does not show.

The trace that is shown is module state in `LineageTabUtils.tsx`, like the column displays, because
`updateColumnEdges` has to re-apply it whenever it rebuilds the column edges. Clicking the pane or an
edge ends it; so does clicking the name of the start row.

`tests/columnLineageEdges.test.ts` covers the derivation, the ports and the trace, `tests/e2e/column-lineage.spec.ts` the rendering.

## Touchpad and mouse wheel

ReactFlow maps the wheel either to zooming (`zoomOnScroll`) or to panning (`panOnScroll`), for every
device alike: a touchpad slide zoomed, and turning on panning would have made a mouse wheel pan
too. Its pinch zoom is also scaled for macOS only, so on other systems it barely moved. So the
graph takes the wheel away from ReactFlow (`useGraphWheelGestures`, capture phase on the panel's
container) and decides per gesture (`src/util/ConfigExplorer/wheelGestures.ts`):

| input | arrives as | does |
|---|---|---|
| two finger slide | wheel, small or fractional or sideways deltas | pans, 1:1 with the fingers |
| pinch | Ctrl+wheel with such deltas; `gesture*` events in Safari | zooms around the pointer, following the fingers |
| mouse wheel, Ctrl+wheel | wheel in line mode, or a notch of at least 50px | zooms, as fast as ReactFlow did |

Browsers do not say which device sent a wheel event, so `guessWheelDevice` is a heuristic: line
mode is a mouse (Firefox), a sideways or fractional delta is a touchpad, and otherwise the size of
the step decides — a wheel notch is 53px (Chrome on Linux) to 100px and more (Windows), a touchpad
step a few pixels. Events less than `GESTURE_GAP_MS` apart keep the device the gesture started
with, so the occasional large step of a fast slide does not turn it into a zoom. A mouse whose
wheel scrolls smoothly in small steps is therefore taken for a touchpad and pans; Ctrl+wheel still
zooms it. Elements marked `nowheel`, and the toolbar and controls outside the renderer, keep the
wheel to themselves.

## Fixtures

Nothing in the getting-started project declares a foreign key, so the relations view would have
nothing to show. `tests/e2e/fixtures/hocon/config/relations.conf` and
`tests/e2e/fixtures/patch-relations.py` add the same keys to both config sources; the latter is run
by `update-fixtures.sh`, because the exported config is downloaded whole and would otherwise lose
them on the next refresh. `public/config/exampleFile.conf` has the same keys for local development.
