# pip install wonderwords
import math
from random import randint, random
from datetime import datetime, timedelta
from wonderwords import RandomWord

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

def randomWorkflow():
    """Generate a random workflow."""
    worflowName = randomWord("nouns")
    runId = randomWord("nouns")
    attemptId = randomWord("nouns")
    runStartTime = randomTime("2021-01-01T00:00:00")
    attemptStartTime = randomTime(runStartTime)
    numActions = randint(50, 100)
    return randomStateFile(worflowName, numActions, runId, attemptId, runStartTime, attemptStartTime)

def main():
    """Generate a random workflow."""
    workflow = randomWorkflow()
    print(workflow)

main()   