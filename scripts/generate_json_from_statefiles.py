import datetime
import json
import math
import os
import uuid

import isodate

# Function that lists the file at the given path
def list_files(path):
    return [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]

# Function that create dictionary from the file names 
def create_dict(path):
    files = list_files(path)
    statefiles = []
    id = uuid.uuid1()
    workflows = {}
    workflow = {}
    runs = {}

    for file in files:
        # Read the file
        with open(os.path.join(path, file)) as f:
            data = json.load(f)
        statefiles.append(data)
    
    names = []
    # Get all the unique names of the workflows
    for data in statefiles:
        names.append(data["appConfig"]["applicationName"])
    
    for name in names:
        workflow[name] = {
            "name": name,
            "runs": [],
        }

    for data in statefiles:
        # Get the important variable of the statefile
        id = id.hex
        runId = data["runId"]
        attemptId = data["attemptId"]
        name = data["appConfig"]["applicationName"]
        appConfig = data["appConfig"]
        actionsState = data["actionsState"]
        runStartTime = data["runStartTime"]
        attemptStartTime = data["attemptStartTime"]

        runs.append(
            {
                "id": id,
                "runId": runId,
                "attemptId": attemptId,
                "runStartTime": runStartTime,
                "attemptStartTime": attemptStartTime,
                "appConfig": appConfig,
                "actionsState": actionsState
            }
        )

        workflow[name]["runs"].append(
            {
                "id": id,
                "runId": runId,
                "attemptId": attemptId,
                "runStartTime": runStartTime,
                "attemptStartTime": attemptStartTime,
                "duration": getDuration(data["actionsState"]),
                "status": "SUCCEEDED"
            }
        )

def getDuration(stateFile):
    """Get the duration of a state file."""
    runStartTime =  datetime.fromisoformat(stateFile["runStartTime"])
    currentLongest = runStartTime
    for action in stateFile["actionsState"].values():
        actionEndTime = datetime.fromisoformat(action["startTStamp"]) + isodate.parse_duration(action["duration"])
        if (currentLongest < actionEndTime): currentLongest = actionEndTime

    diff = datetime.timedelta.total_seconds(currentLongest - runStartTime)*1000
    tmp = formatDuration(diff)
    return tmp

def formatDuration(ms):
    ms = math.floor(ms * 10000000)
    milliseconds = ms % 1000
    seconds = (ms // 1000) % 60
    minutes = (ms // (1000 * 60)) % 60
    hours = (ms // (1000 * 60 * 60)) % 24
    if hours > 0:
        return f"PT{hours}H{minutes}M{seconds}.{milliseconds}S"
    if minutes > 0:
        return f"PT{minutes}M{seconds}.{milliseconds}S"
    return f"PT{seconds}.{milliseconds}S"

def main():
    print("Generating database...")
    script_dir = os.path.dirname(__file__)
    path = os.path.join(script_dir, "./data_directory")
    dict = create_dict(path)
    db = {"workflows": [], "runs": [], "workflow": []}
    print("Done.")

if __name__ == "__main__":
    main()