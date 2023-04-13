# pip install wonderwords
import isodate
from random import randint, random
from datetime import datetime, timedelta
from wonderwords import RandomWord
import json
import os

placeHolderString = "NaN"
placeHolderNumber = -1
placeHoledrBool = False

def randomWord(type):
    """Generate a random word."""
    return RandomWord().word(include_parts_of_speech=[type])

def randomStateFile(worflowName, numActions, runId, attemptId, runStartTime, attemptStartTime):
    """Generate a random state file."""
    stateFile = {
        'appConfig' : {
            'feedSel' : placeHolderString,
            'applicationName' : worflowName,
            'configuration' : placeHolderString,
            'parallelism' : placeHolderNumber,
            'statePath' : placeHolderString,
            'streaming' : placeHoledrBool,
        },
        'runId' : runId,
        'attemptId' : attemptId,
        'runStartTime' : runStartTime,
        'attemptStartTime' : attemptStartTime,
        'actionsState' : randomActionsState(numActions, attemptStartTime, runId, attemptId),
    }

    return stateFile

def randomActionsState(numActions, attemptStartTime, runId, attemptId):
    """Generate a random actions state."""
    actionsState = {}
    for i in range(numActions):
        state = randomState()
        action = {
            'executionId' : {
                'runId' : runId,
                'attemptId' : attemptId,
                'type' : placeHolderNumber,
            },
            'state' : state,
            'startTStamp' : randomTime(attemptStartTime),
            'duration' : randomDuration(),
            'msg' : placeHolderString,
            'results': randomResults(),
        }
        actionsState[randomWord("nouns")] = action
    
    return actionsState

def randomState():
    """Generate a random state."""
    p = random()
    if p < 0.8:
        return "SUCCEEDED"
    if p < 0.95:
        return "SKIPPED"
    return "CANCELLED"

def randomTime(attemptStartTime):
    """Generate a random time."""
    offset = timedelta(randint(0, 150000))
    newTime = datetime.fromisoformat(attemptStartTime) + offset
    return newTime.isoformat()

def randomDuration():
    """Generate a random duration."""
    ms = randint(5000, 30000)
    milliseconds = ms % 1000
    seconds = (ms // 1000) % 60
    minutes = (ms // (1000 * 60)) % 60
    hours = (ms // (1000 * 60 * 60)) % 24
    if hours > 0:
        return f"PT{hours}H{minutes}M{seconds}.{milliseconds}"
    if minutes > 0:
        return f"PT{minutes}M{seconds}.{milliseconds}"
    return f"PT{seconds}.{milliseconds}"

def randomResults():
    """Generate a random results."""
    results = []
    for i in range(randint(1, 5)):
        results.append({
            'subFeed' :{
                "type" : placeHolderNumber,
                "dataObjectId" : placeHolderNumber,
                "partitionValues" : [placeHolderNumber],
                "isSkipped" : placeHoledrBool,
                "isDAGStart" : placeHoledrBool,
                "isDummy" : placeHoledrBool
            },
            'mainMetrics' : {
                "stage" : placeHolderString,
                "count" : placeHolderNumber,
                "num_tasks" : placeHolderNumber,
                "no_data" : placeHoledrBool,
                "records_written" : placeHolderNumber,
                "stage_duration" : placeHolderNumber,
                "bytes_written" : placeHolderNumber
            }
        })
    
    return results

def randomWorkflows():
    workflows = []
    workflow = []
    runs = []
    uid = 0

    for i in range(100): # 100 workflows
        workflowName = randomWord("nouns")
        runId = 0
        attemptId = 0
        numRuns = randint(50, 100)
        records = []

        for i in range(numRuns): # 50-100 runs per workflow
            if random() < 0.5:
                attemptId += 1
            else:
                runId += 1
                attemptId = 0

            records.append({
                "uid": uid,
                "stateFile": randomStateFile 
                (
                    workflowName, 
                    randint(50, 100), 
                    runId, attemptId, 
                    randomTime("2020-01-01T00:00:00"), 
                    randomTime("2020-01-01T00:00:00")
            )})
            uid += 1
        workflows.append({"name": workflowName, "numRuns": runId, "numAttempts": numRuns, "lastDuration": -1, "lastStatus": "SUCCEEDED"})
        
        workflowRun = []
        for record in records:
            runs.append(
                {
                    "id": record["uid"], 
                    "runId": record["stateFile"]["runId"],
                    "attemptId": record["stateFile"]["attemptId"],
                    "runStartTime": record["stateFile"]["runStartTime"],
                    "attemptStartTime": record["stateFile"]["attemptStartTime"],
                    "appConfig": record["stateFile"]["appConfig"],
                    "actionsState": record["stateFile"]["actionsState"]
                } 
            )
            workflowRun.append(
                {
                    "id" : record["uid"],
                    "runId" : record["stateFile"]["runId"],
                    "attemptId" : record["stateFile"]["attemptId"],
                    "runStartTime" : record["stateFile"]["runStartTime"],
                    "duration" : getDuration(record["stateFile"]),
                    "status" : getStatus(record["stateFile"]),
                }
            )
        workflow.append({"name": workflowName, "runs": workflowRun})
    return {"workflows": workflows, "runs": runs, "workflow": workflow}

def getDuration(stateFile):
    """Get the duration of a state file."""
    duration = -1
    for action in stateFile["actionsState"].values():
        duration = (duration < isodate.parse_duration(action["duration"])) if isodate.parse_duration(action["duration"]) else duration
    return duration

def getStatus(stateFile):
    """Get the status of a state file."""
    for action in stateFile["actionsState"].values():
        if action["state"] == "CANCELLED":
            return "CANCELLED"
    return "SUCCEEDED"

def main():
    db = randomWorkflows()
    script_dir = os.path.dirname(__file__)
    path = os.path.join(script_dir, 'output/db.json')
    with open(path, "w") as outfile:
        json.dump(db, outfile)

    

if __name__ == "__main__":
    main()