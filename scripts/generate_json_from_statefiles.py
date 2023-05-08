from datetime import datetime, timedelta
from wonderwords import RandomWord
import isodate
import json
import math
import os
import uuid

def randomWord(type):
    """Generate a random word."""
    return RandomWord().word(include_parts_of_speech=[type])

# Function that lists the file at the given path
def list_files(path):
    return [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]

# Function that create dictionary from the file names 
def create_dict(path):
    files = list_files(path)
    statefiles = []
    id = uuid.uuid4()
    workflows = []
    workflow_tmp = {}
    runs = []

    nFiles = len(files)

    for i in range(nFiles):
        file = files[i]
        # Read the file
        with open(os.path.join(path, file)) as f:
            data = json.load(f)
        statefiles.append(data)
    
    names = []
    # Get all the unique names of the workflows
    for data in statefiles:
        names.append(data["appConfig"]["applicationName"])
    
    for name in names:
        workflow_tmp[name] = {
            "name": name,
            "runs": [],
        }

    for data in statefiles:
        # Get the important variable of the statefile
        uid = id.hex
        runId = data["runId"]
        attemptId = data["attemptId"]
        name = data["appConfig"]["applicationName"]
        appConfig = data["appConfig"]
        actionsState = data["actionsState"]
        runStartTime = data["runStartTime"]
        attemptStartTime = data["attemptStartTime"]

        runs.append(
            {
                "id": str(id),
                "runId": runId,
                "attemptId": attemptId,
                "runStartTime": runStartTime,
                "attemptStartTime": attemptStartTime,
                "appConfig": appConfig,
                "actionsState": actionsState
            }
        )

        status = getStatus(actionsState)
        duration = "PT0.0S"
        if(status != "CANCELLED"): duration = getDuration(data)

        workflow_tmp[name]["runs"].append(
            {
                "id": str(id),
                "runId": runId,
                "attemptId": attemptId,
                "runStartTime": runStartTime,
                "attemptStartTime": attemptStartTime,
                "status": status,
                "duration": duration,
            }
        )
    
    workflow = []
    for workflow_p in workflow_tmp.values():
        workflow.append(workflow_p)
        lastRun = getLastRun(workflow_p["runs"])
        firstRun = getFirstRun(workflow_p["runs"])
        workflows.append(
            {
                "name": workflow_p["name"],
                "numRuns": lastRun["runId"] - firstRun["runId"] + 1,
                "numAttempts": len(workflow_p["runs"]),
                "lastDuration": lastRun["duration"],
                "lastStatus": lastRun["status"],
            }
        )
    
    return {"workflows": workflows, "runs": runs, "workflow": workflow}

def getLastRun(runs):
    """Get the last run of a workflow."""
    lastRun = runs[0]
    for run in runs:
        if run["runId"] > lastRun["runId"]:
            lastRun = run
    return lastRun

def getFirstRun(runs):
    """Get the last run of a workflow."""
    firstRun = runs[0]
    for run in runs:
        if run["runId"] < firstRun["runId"]:
            firstRun = run
    return firstRun

def getStatus(actionsState):
    """Get the status of a state file."""
    for action in actionsState.values():
        if action["state"] == "CANCELLED":
            return "CANCELLED"
    return "SUCCEEDED"

def getDuration(stateFile):
    """Get the duration of a state file."""
    runStartTime =  isodate.parse_datetime(stateFile["runStartTime"])
    currentLongest = runStartTime
    for action in stateFile["actionsState"].values():
        if "startTstmp" in action.keys():
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

def main():
    print("Generating database...")
    script_dir = os.path.dirname(__file__)
    path = os.path.join(script_dir, "heidi")
    db = create_dict(path)
    print("Writing database...")
    path = os.path.join(script_dir, f"output/db_heidi.json")
    with open(path, "w") as outfile:
        json.dump(db, outfile)
    
    print("Done.")

if __name__ == "__main__":
    main()