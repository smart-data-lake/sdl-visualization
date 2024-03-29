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
            buildVersion = find("buildVersionInfo.version", data) # ignore if not found
            appVersion = find("appVersion", data) # ignore if not found
            status = getStatus(actionsState)
            runEndTime = getRunEndTime(data)
            actions = {
                key: {
                    "state": actionsState[key]["state"], 
                    "dataObjects": [d if isinstance(d,str) else d.get("id") for d in actionsState[key].get("outputIds", [])] or [r["subFeed"]["dataObjectId"] for r in actionsState[key].get("results", [])]
                } for key in actionsState
            }

            runs.append(
                {
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
            )

        except Exception as ex:
            print("ERROR while reading file "+statefile["path"])
            raise ex        
    
    return runs

def getStatus(actionsState):
    """Get the status of a state file."""
    prio = ["FAILED", "CANCELLED", "RUNNING", "SUCCEEDED", "SKIPPED", "STARTED", "INITIALIZED", "PREPARED"]
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