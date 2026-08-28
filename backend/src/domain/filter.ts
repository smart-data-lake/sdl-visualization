import { getPropertyByPathIgnoreCase, onlyUnique } from './helpers.js';
import type { ConfigJson } from './types.js';

/**
 * Configuration search, ported from InitialConfigDataLists in
 * src/util/ConfigExplorer/ConfigData.ts.
 *
 * The point of the port is parity: an agent asking search_config must get the same
 * answer as a user typing into the config explorer's search box, including the
 * case-insensitive property lookup and the feedSel grammar. tests/configFilter.test.ts
 * is run against this copy too - see test/unit.
 *
 * One deliberate difference: the frontend stamps `id` onto the configuration objects
 * in place. Here the objects come out of a cache shared between requests, so each
 * entry is shallow-copied instead of mutated.
 */

export interface ConfigDataLists {
  dataObjects: any[];
  actions: any[];
  connections: any[];
}

export type SearchType = 'id' | 'property' | 'feedSel';

export class ConfigDataLists_ implements ConfigDataLists {
  public dataObjects: any[] = [];
  public actions: any[] = [];
  public connections: any[] = [];
  private initial: ConfigJson | undefined;

  constructor(config?: ConfigJson) {
    this.initial = config;
    if (config) {
      this.dataObjects = sortedEntries(config.dataObjects ?? {});
      this.actions = sortedEntries(config.actions ?? {});
      this.connections = sortedEntries(config.connections ?? {});
    }
  }

  applyContainsFilter(prop: string, str: string): ConfigDataLists {
    if (!str) return this;
    const propClean = prop.trim();
    const strLower = str.trim().toLowerCase();
    return this.applyFilterFunc((obj: any) => {
      const v = getPropertyByPathIgnoreCase(obj, propClean);
      return typeof v === 'string' && v.toLowerCase().includes(strLower);
    });
  }

  applyRegexFilter(prop: string, regex: string): ConfigDataLists {
    if (!prop) return this;
    return this.applyFilterFunc(regexFilterFunc(prop, regex));
  }

  /**
   * Filter actions with SDLB's feed selector syntax,
   * "<prefix:?><regex>,<operation?><prefix:?><regex>;...", then pull in every data
   * object those actions touch and every connection those data objects use.
   * See Apputil.filterActionList in the Scala project.
   */
  applyFeedFilter(feedSel: string): ConfigDataLists {
    if (!feedSel || !this.initial) return this;

    const patterns = feedSel.toLowerCase().split(',');
    const opMatcher = /([|&-])?(.*)/;
    const prefixMatcher = /([a-z]+:)?(.*)/;

    const actionIds = patterns.reduce<string[]>((result, patternWithOp) => {
      const opMatch = patternWithOp.trim().match(opMatcher);
      if (!opMatch) throw new Error(`'${patternWithOp}' did not match '<operation?><prefix:?><regex>'`);
      const [, op, pattern] = opMatch;
      const prefixMatch = pattern.trim().match(prefixMatcher);
      if (!prefixMatch) throw new Error(`'${pattern}' did not match '<prefix:?><regex>'`);
      const [, prefix, regex] = prefixMatch;
      const selected = this.filterActionsByPrefix(prefix, regex).map((a) => a.id);

      switch (op) {
        case undefined: // union is the default
        case '|': {
          const merged = [...result];
          selected.forEach((a) => {
            if (!merged.includes(a)) merged.push(a);
          });
          return merged;
        }
        case '&':
          return result.filter((a) => selected.includes(a));
        case '-':
          return result.filter((a) => !selected.includes(a));
        default:
          throw new Error(`Unknown operation ${op} for pattern ${pattern}`);
      }
    }, []);

    const config = this.initial;
    const selectedActions = actionIds
      .map((id) => withId(config.actions?.[id], id))
      .filter((a) => a !== undefined);

    const selectedDataObjects: any[] = [];
    for (const action of selectedActions) {
      const ids = [
        action.inputId,
        action.outputId,
        ...(action.inputIds ?? []),
        ...(action.outputIds ?? []),
      ].filter((id): id is string => typeof id === 'string');
      for (const id of ids) {
        const dataObject = withId(config.dataObjects?.[id], id);
        if (dataObject) selectedDataObjects.push(dataObject);
      }
    }

    const selectedConnections: any[] = [];
    for (const dataObject of selectedDataObjects) {
      if (dataObject.connectionId) {
        const connection = withId(config.connections?.[dataObject.connectionId], dataObject.connectionId);
        if (connection) selectedConnections.push(connection);
      }
    }

    return {
      actions: selectedActions,
      dataObjects: dedupeById(selectedDataObjects),
      connections: dedupeById(selectedConnections),
    };
  }

  private filterActionsByPrefix(prefix: string | undefined, regex: string): any[] {
    switch (prefix) {
      case undefined: // the default is to filter by feed
      case 'feeds:':
        return this.actions.filter(regexFilterFunc('metadata.feed', regex, true));
      case 'names:':
        return this.actions.filter(regexFilterFunc('metadata.name', regex, true));
      case 'ids:':
        return this.actions.filter(regexFilterFunc('id', regex, true));
      case 'layers:':
        return this.actions.filter(regexFilterFunc('metadata.layer', regex, true));
      case 'startfromactionids:':
      case 'endwithactionids:':
      case 'startfromdataobjectids:':
      case 'endwithdataobjectids:':
        throw new Error(`Prefix ${prefix} is not yet implemented`);
      default:
        throw new Error(`Unknown prefix ${prefix} for regex ${regex}`);
    }
  }

  private applyFilterFunc(filterFunc: (obj: any) => boolean): ConfigDataLists {
    return {
      dataObjects: this.dataObjects.filter(filterFunc),
      actions: this.actions.filter(filterFunc),
      connections: this.connections.filter(filterFunc),
    };
  }

  isEmpty(): boolean {
    return (
      this.dataObjects.length === 0 && this.actions.length === 0 && this.connections.length === 0
    );
  }
}

/**
 * Searching is case insensitive for the property name as well as for its value, so
 * a search matches Type:deltalake as well as type:DeltaLake.
 */
function regexFilterFunc(prop: string, regex: string, anchored = false): (obj: any) => boolean {
  const propClean = prop.trim();
  let regexObj = /.*/;
  try {
    regexObj = anchored ? new RegExp(`^${regex.trim()}$`, 'i') : new RegExp(regex.trim(), 'i');
  } catch {
    if (regex) throw new Error(`regular expression "${regex}" not valid`);
  }
  return (obj: any) => {
    const v = getPropertyByPathIgnoreCase(obj, propClean);
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.some((e) => typeof e === 'string' && regexObj.test(e));
    return typeof v !== 'object' && regexObj.test(String(v));
  };
}

function sortedEntries(obj: Record<string, any>): any[] {
  return Object.entries(obj)
    .map(([key, value]) => withId(value, key))
    .filter((v) => v !== undefined)
    .sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
}

/** The configuration keys the element by its id, the UI wants it on the element. */
function withId(value: any, id: string): any {
  if (!value || typeof value !== 'object') return undefined;
  return { ...value, id };
}

function dedupeById(list: any[]): any[] {
  const ids = list.map((e) => e.id);
  return list.filter((_, index) => ids.indexOf(ids[index]) === index);
}

/**
 * The dispatcher behind the config explorer's search box (applyFilter in
 * ConfigExplorer.tsx). "property" splits the query on the first : or =.
 */
export function applyFilter(
  lists: ConfigDataLists_,
  search: { text: string; type: SearchType },
): ConfigDataLists {
  const { text, type } = search;
  if (!text) return lists;
  switch (type) {
    case 'id':
      return lists.applyContainsFilter('id', text);
    case 'property': {
      const separator = text.search(/[:=]/);
      if (separator < 0) return lists.applyContainsFilter('id', text);
      return lists.applyRegexFilter(text.slice(0, separator), text.slice(separator + 1));
    }
    case 'feedSel':
      return lists.applyFeedFilter(text);
    default:
      throw new Error(`Unknown search type ${type}`);
  }
}

export { onlyUnique };
