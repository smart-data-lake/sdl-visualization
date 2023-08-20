from datetime import datetime, timedelta
import time
from wonderwords import RandomWord
import isodate
import json
import math
import os
import uuid
import sys
from functools import reduce
import operator

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
    id = uuid.uuid4()
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
            status = getStatus(actionsState)
            duration = "PT0.0S"
            if(status != "CANCELLED"): duration = getDuration(data)

            runs.append(
                {
                    "id": str(id),
                    "runId": data["runId"],
                    "attemptId": data["attemptId"],
                    "name": appConfig["applicationName"],
                    "feedSel": appConfig["feedSel"],
                    "runStartTime": data["runStartTime"],
                    "attemptStartTime": data["attemptStartTime"],
                    "status": status,
                    "duration": duration,
                    "buildVersion": buildVersion,
                    "path": statefile["path"].lstrip("./"),
                }
            )

        except Exception as ex:
            print("ERROR while reading file "+statefile["path"])
            raise ex        
    
    return runs

def getStatus(actionsState):
    """Get the status of a state file."""
    curr = "SUCCEEDED"
    for action in actionsState.values():
        if action["state"] == "CANCELLED":
            curr = "CANCELLED"
        elif action["state"] == "FAILED":
            curr = "FAILED"
            
    return curr

def getDuration(stateFile):
    """Get the duration of a state file."""
    runStartTime =  isodate.parse_datetime(stateFile["runStartTime"])
    currentLongest = runStartTime
    for action in stateFile["actionsState"].values():
        if "startTstmp" in action.keys() and "duration" in action.keys():
            actionEndTime = isodate.parse_datetime(action["startTstmp"]) + isodate.parse_duration(action["duration"])
        else:
            actionEndTime = runStartTime
        if (currentLongest < actionEndTime): currentLongest = actionEndTime

    diff = timedelta.total_seconds(currentLongest - runStartTime)
    tmp = formatDuration(diff)
    return tmp

def formatDuration(seconds):
    """Format the duration in seconds to a string."""
    ms = math.floor(seconds * 1000)
    if ms < 1000:
        return f"PT0.{ms}S"
    elif ms < 60*1000:
        return f"PT{ms/1000}S"
    elif ms < 60*60*1000:
        return f"PT{ms//(1000*60)}M{(ms%(1000*60))/1000}S"
    else:
        return f"PT{ms//(1000*60*60)}H{(ms%(1000*60*60))//(1000*60)}M{(ms%(1000*60))/1000}S"

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
            json.dump(runs, outfile, ensure_ascii=False, indent=4)
        print(f"Summaries written to {path}/{indexFile}\n \n")
        os.chdir(cwd)

def buildConfigIndex(path):
    if (not os.path.isdir(path)):
        print("The path you provided as argument does not exist. Skipping config index building.")

    else:
        print(f"The tool will compile all config files in \"{path}\" and its subdirectories into \"index.json\". If no config files are present, a default empty index is returned:")
        print(f"Retrieving configs \"{path}\"...")
        cwd = os.getcwd()
        os.chdir(path)
        files = list_files(".", ".conf")
        print(f"{len(files)} files found.")
        print("Creating index...")
        db = list(map(lambda f: f.lstrip("./"), files))
        indexFile = "index.json"
        with open(indexFile, "w") as outfile:
            json.dump(db, outfile, ensure_ascii=False, indent=4)
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