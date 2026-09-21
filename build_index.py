import isodate
import json
import os
import sys
import collections
from functools import reduce

def find(element, json):
    return reduce(lambda x,y: x.get(y) if x else None, element.split('.'), json)

# Function that lists the file at the given path
def list_files(path, extension):
    list = []
    for path, subdirs, files in os.walk(path):
        for name in files:
            if (name.endswith(extension) and (not name.startswith("index"))):
                list.append(os.path.join(path, name))
    return list

# Function that create array of runs
def getRuns(files):
    statefiles = []
    runs = []

    for file in files:
        # Read the file
        with open(file) as f:
            data = json.load(f)
        statefiles.append({"data": data, "path": file})
    
    for statefile in statefiles:
        try:
            # Get the important variable of the statefile
            data = statefile["data"]
            appConfig = data["appConfig"]
            actionsState = data["actionsState"]
            buildVersion = find("sdlbVersionInfo.version", data) # ignore if not found
            appVersion = find("appVersionInfo.version", data) # ignore if not found
            status = getStatus(actionsState)
            runEndTime = getRunEndTime(data)
            actions = {
                key: {
                    "state": actionsState[key]["state"], 
                    "dataObjects": [d if isinstance(d,str) else d.get("id") for d in actionsState[key].get("outputIds", [])] or [r["subFeed"]["dataObjectId"] for r in actionsState[key].get("results", [])]
                } for key in actionsState
            }

            run = {
                "name": appConfig["applicationName"],
                "runId": data["runId"],
                "attemptId": data["attemptId"],
                "feedSel": appConfig["feedSel"],
                "runStartTime": data["runStartTime"],
                "attemptStartTime": data["attemptStartTime"],
                "runEndTime": runEndTime,
                "status": status,
                "actions": actions,
                "buildVersion": buildVersion,
                "appVersion": appVersion,
                "path": statefile["path"].lstrip("./"),
            }
            # left out rather than null when nothing was selected, as the backend leaves it out
            selected = selectedPartitionValuesOfRun(actionsState)
            if selected: run["selectedPartitionValues"] = selected
            runs.append(run)

        except Exception as ex:
            print("ERROR while reading file "+statefile["path"])
            raise ex        
    
    return runs

# Copied from backend/src/domain/partitionValues.ts and src/util/WorkflowsExplorer/
# partitionValues.ts. There is no python test suite, so keep this a literal transcription.
MAX_PARTITION_VALUES = 10

def formatPartitionValue(value):
    """One partition value: `dt=2024-01-01`, several keys joined by `/`."""
    # older state files wrap the map in `elements`, and nothing normalizes them on this path
    elements = value.get("elements", value) if isinstance(value, dict) else value
    if elements is None: return ""
    if not isinstance(elements, dict): return str(elements)
    return "/".join(f"{key}={element}" for key, element in elements.items())

def formatPartitionValues(values):
    """Distinct partition values as one cell of a table, longest lists abbreviated."""
    formatted = [v for v in (formatPartitionValue(value) for value in (values or [])) if v]
    distinct = list(dict.fromkeys(formatted))
    if len(distinct) <= MAX_PARTITION_VALUES: return ", ".join(distinct)
    return ", ".join(distinct[:MAX_PARTITION_VALUES]) + f", \u2026 (+{len(distinct) - MAX_PARTITION_VALUES} more)"

def partitionValuesOfAction(action):
    """The partition values of every result of an action, old and new state file format."""
    values = []
    for result in action.get("results", []):
        subFeed = result.get("subFeed", result)
        values.extend(subFeed.get("partitionValues") or [])
    return values

def writtenDataObjects(action):
    """The ids of the data objects an action wrote, with the pre-outputIds fallback."""
    outputIds = [d if isinstance(d, str) else d.get("id") for d in action.get("outputIds", [])]
    if outputIds: return outputIds
    return [r.get("dataObjectId") or r["subFeed"]["dataObjectId"] for r in action.get("results", [])]

def actionsInDagOrder(actionsState):
    """
    The actions in topological order: an action follows every action that wrote one of the data
    objects it reads, and of the actions ready at each step the alphabetically first is taken.
    Mirrors actionsInDagOrder in backend/src/domain/stateFile.ts.
    """
    producers = collections.defaultdict(list)
    for name, action in actionsState.items():
        for dataObjectId in writtenDataObjects(action):
            producers[dataObjectId].append(name)
    predecessors = {
        name: {p for i in (action.get("inputIds") or []) for p in producers.get(i if isinstance(i, str) else i.get("id"), []) if p != name}
        for name, action in actionsState.items()
    }

    remaining = set(actionsState.keys())
    order = []
    while remaining:
        ready = [name for name in remaining if not (predecessors[name] & remaining)]
        if not ready:
            # a cycle SDLB's DAG cannot produce, but a hand written state file can
            order.extend(sorted(remaining))
            break
        next = min(ready)
        order.append(next)
        remaining.remove(next)
    return order

def selectedPartitionValuesOfRun(actionsState):
    """The partition values of the first action in the DAG that selected any."""
    for name in actionsInDagOrder(actionsState):
        values = formatPartitionValues(partitionValuesOfAction(actionsState[name]))
        if values: return values
    return None

def getStatus(actionsState):
    """Get the status of a state file."""
    prio = ["FAILED", "CANCELLED", "RUNNING", "SUCCEEDED", "SKIPPED", "INITIALIZING", "INITIALIZED", "PREPARING", "PREPARED", "PENDING"]
    minIdx = len(prio) -1
    for action in actionsState.values():
        minIdx = min(minIdx, prio.index(action["state"]))            
    return prio[minIdx]

def getRunEndTime(stateFile):
    """Get the end time of a state file."""
    maxEndTime = isodate.parse_datetime(stateFile["attemptStartTime"])
    for action in stateFile["actionsState"].values():
        actionEndTime = maxEndTime
        if "endTstmp" in action.keys():
            actionEndTime = isodate.parse_datetime(action["endTstmp"])
        elif "startTstmp" in action.keys() and "duration" in action.keys():
            actionEndTime = isodate.parse_datetime(action["startTstmp"]) + isodate.parse_duration(action["duration"])
        if (actionEndTime and maxEndTime < actionEndTime): maxEndTime = actionEndTime
    return maxEndTime.isoformat()

def buildStateIndex(path):
    if (not os.path.isdir(path)):
        print("The path you provided as argument does not exist. Skipping state index building.")

    else: 
        print(f"The tool will compile all state files in \"{path}\" and its subdirectories into \"index.json\" of your SLDB projct. If no statefiles are present, a default empty index is returned:")
        print(f"Retrieving summaries \"{path}\"...")
        cwd = os.getcwd()
        os.chdir(path)
        files = list_files(".", ".json")
        print(f"{len(files)} files found.")
        print("Creating summaries...")
        runs = getRuns(files)
        indexFile = "index.json"
        with open(indexFile, "w") as outfile:
            # this appends every run as json line to the outfile
            for run in runs:                
                json.dump(run, outfile, ensure_ascii=False, default=str)
                print("", file=outfile) # add new line after every run object
        print(f"Summaries written to {path}/{indexFile}\n \n")
        os.chdir(cwd)

def buildConfigIndex(path):
    if (not os.path.isdir(path)):
        print("The path you provided as argument does not exist. Skipping config index building.")

    else:
        print(f"The tool will compile all config files in \"{path}\" and its subdirectories into \"index\" file. If no config files are present, a default empty index is returned:")
        print(f"Retrieving configs \"{path}\"...")
        cwd = os.getcwd()
        os.chdir(path)
        files = list_files(".", ".conf")
        print(f"{len(files)} files found.")
        print("Creating index...")
        indexFile = "index"
        with open(indexFile, "w") as outfile:
            for file in files:
                outfile.write(file.lstrip("./")+"\n")
        print(f"Index written to {path}/{indexFile}\n \n")
        os.chdir(cwd)

def main():

    print("\n\n=====================================")
    print("~~ Welcome to the index building tool ~~ \n")

    # Create statefiles index

    if len(sys.argv) < 2:
        print("No path provided as argument. Exiting index building tool.")
    else: 

        buildStateIndex(sys.argv[1].rstrip("/"))

        # Create config index
        if len(sys.argv) < 3:
            print("No path provided as argument for config index building. Exiting index building tool...")
        else:
            buildConfigIndex(sys.argv[2].rstrip("/"))
    
    print("\n~~ Index building done ~~")
    print("=====================================\n\n")

if __name__ == "__main__":
    main()