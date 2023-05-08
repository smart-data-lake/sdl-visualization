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
    list = []
    for path, subdirs, files in os.walk(path):
        for name in files:
            if (name.endswith(".json") and (not name.startswith("index"))):
                list.append(os.path.join(path, name))
    return list

# Function that create dictionary from the file names 
def create_dict(files):
    statefiles = []
    id = uuid.uuid4()
    workflows = []
    workflow_tmp = {}
    runs = []

    for file in files:
        # Read the file
        with open(file) as f:
            data = json.load(f)
        statefiles.append({"data": data, "path": file})
    
    names = []
    # Get all the unique names of the workflows
    for statefile in statefiles:
        names.append(statefile["data"]["appConfig"]["applicationName"])
    
    for name in names:
        workflow_tmp[name] = {
            "name": name,
            "runs": [],
        }

    for statefile in statefiles:
        # Get the important variable of the statefile
        uid = id.hex
        data = statefile["data"]
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
                "name": appConfig["applicationName"],
                "path": statefile["path"].split("scripts/../public")[1],
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
    
    # Note: the "runs" is legacy and should be removed in the future
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
    print("=====================================")
    print("~~ Welcome to the visualizer setup tool ~~ \n")
    print("The tool will compile all state files in \"/public/state\" into \"/public/index.json\". If no statefiles are present, a default index is returned:")
    
    script_dir = os.path.dirname(__file__)
    path = os.path.join(script_dir, f"../public/state")
    print(f"Retrieving summaries \"{path}\"...")
    files = list_files(path)
    print(f"{len(files)} files found.")
    print("Creating summaries...")
    db = create_dict(files)
    print("Writing summaries...")
    with open(f"{path}/index.json", "w") as outfile:
        json.dump(db, outfile, ensure_ascii=False, indent=4)
    print("Summaries written. \n \n")
    """ if (not os.path.exists(os.path.join(script_dir, "output"))):
            os.mkdir(os.path.join(script_dir, "output"))
        
    path = os.path.join(script_dir, f"output/db_{folder_name}.json")
    with open(path, "w") as outfile:
        json.dump(db, outfile)
     """
    print("\nEnter the name of the source directory containing your config files (the folder must be in \"/public/config\"). If none press enter:")
    folder_name_config = str(input())
    while (not os.path.exists(os.path.join(script_dir, f"../public/config/{folder_name_config}"))):
        print("The directory does not exist. Please try again:")
        folder_name_config = str(input())

    if folder_name_config != "":
        path = os.path.join(script_dir, f"../public/config/{folder_name_config}")
        print(f"Generating index for \"{path}\"...")
        print(os.listdir(path))
    
    print("\n~~ Setup complete ~~")
    print("=====================================")

if __name__ == "__main__":
    main()