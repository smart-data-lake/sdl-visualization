from datetime import datetime, timedelta
import time
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
def list_files(path, extension):
    list = []
    for path, subdirs, files in os.walk(path):
        for name in files:
            if (name.endswith(extension) and (not name.startswith("index"))):
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
    script_dir = os.path.dirname(__file__)
    
    print("\n\n=====================================")
    print("~~ Welcome to the index building tool ~~ \n")
    print("In the following steps, indicate the paths relative to the location of the root folder of the project. \n")
    time.sleep(1.2)
    print("Please enter the path to the directory containing you statefiles. Press enter if you have no statefiles.")
    statefiles_path = input("Path: ")
    while (statefiles_path != '' and not os.path.isdir(os.path.join(script_dir, '../', statefiles_path))):
        print("The path you entered does not exist. Please enter a valid path.")
        statefiles_path = input("Path: ")
    
    if (statefiles_path != ''):
        print(f"The tool will compile all state files in \"{statefiles_path}\" and its subdirectories into \"public/state/index.json\". If no statefiles are present, a default empty index is returned:")
        path = os.path.join(script_dir, "../", statefiles_path)
        print(f"Retrieving summaries \"{path}\"...")
        files = list_files(path, ".json")
        print(f"{len(files)} files found.")
        if len(files) > 0:
            print("Creating summaries...")
            db = create_dict(files)
            print("Writing summaries...")
            with open(os.path.join(script_dir, "../public/state/index.json"), "w") as outfile:
                json.dump(db, outfile, ensure_ascii=False, indent=4)
            print("Summaries written. \n \n")
        
        with open(os.path.join(script_dir, "../public/manifest.json")) as json_file:
            manifest = json.load(json_file)
            manifest["statefilesIndex"] = "state/index.json"
            json.dump(manifest, open(os.path.join(script_dir, "../public/manifest.json"), "w"), ensure_ascii=False, indent=4)

        print(manifest)
    else:
        print('No statefiles path provided. Skipping statefile index creation.')
     

    print("The tool will compile all config files in \"/public/config\" and its subdirectories into \"/public/config/index.json\". If no config files are present, a default empty index is returned:")
    
    path = os.path.join(script_dir, f"../public/config")
    print(f"Retrieving configs \"{path}\"...")
    files = list_files(path, ".conf")
    print(f"{len(files)} files found.")
    if len(files) > 0:
        print("Creating index...")
        db = [f.split("scripts/../public/config")[1] for f in files]
        print("Writing summaries...")
        with open(f"{path}/index.json", "w") as outfile:
            json.dump(db, outfile, ensure_ascii=False, indent=4)
        print("Summaries written. \n \n") 
    

    
    print("\n~~ Index building complete ~~")
    print("=====================================\n\n")

if __name__ == "__main__":
    main()