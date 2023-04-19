import { ActionsState, Action, StateFile } from "../../types"
import { uniqueNamesGenerator, adjectives, colors, animals, names, languages, starWars, countries } from 'unique-names-generator';

export default function randomStateFile(name?: string, runId?: number) {
    const runStartTime = new Date();

    return {
        appConfig : {
            feedSel : name || '',
            applicationName : name || uniqueNamesGenerator({dictionaries: [names], style: 'upperCase'}),
            configuration : '/config',
            parallelism : 0,
            statePath : '/state',
            streaming : false
        },
        runId : runId || Math.round(Math.random()*100),
        attemptId : Math.round(Math.random()*10),
        runStartTime : runStartTime.toString(),
        attemptStartTime : runStartTime.toString(),
        actionsState : randomActionsState(runStartTime)
    }
}

export function randomActionsState(runStartTime : Date)  {
    const actionsNames = Array(Math.round(Math.random()*60)).fill(null).map(
        () => {
            return uniqueNamesGenerator({dictionaries: [adjectives, colors, animals]})
    });
    const actionsState: ActionsState = {};
    actionsNames.forEach(
        (name) => {
            actionsState[name] = randomAction(runStartTime);
    })
    return actionsState;
}

export function randomAction(runStartTime : Date) {
    const state = randomState();
    const action : Action = {
        executionId: {
            type : uniqueNamesGenerator({ dictionaries: [languages] }),
            runId : Math.round(Math.random() * 1000),
            attemptId : Math.round(Math.random() * 1000),
        },
        state : state,
        msg: 'This is a random action :)',
        startTStamp : new Date(runStartTime.getTime() + Math.round(Math.random() * 50000) + 100).toISOString(),
        duration : 'PT' + (Math.random() * 60).toFixed(3) + 'S',
        results : [{
            subFeed : state === 'SUCCEEDED' ? {
                type : uniqueNamesGenerator({ dictionaries: [languages] }),
                dataObjectId : uniqueNamesGenerator({ dictionaries: [countries] }),
                partitionValues : [uniqueNamesGenerator({ dictionaries: [animals] })],
                isDAGStart : true,
                isSkipped : true,
                isDummy : true,
            } : undefined,
            mainMetrics : state === 'SUCCEEDED' ? {
                stage : uniqueNamesGenerator({ dictionaries: [starWars] }),
                num_tasks : Math.round(Math.random()),
                records_written : Math.round(Math.random()*1000000),
                stage_duration : 'PT' + (Math.random() * 60).toFixed(3) + 'S',
                bytes_written : Math.round(Math.random()*1000000),

            } : undefined
        }]
    }
    return action;
}

export function randomState () {
    const threshold = Math.round(Math.random()*100);
    return threshold < 90 ? 'SUCCEEDED' : (threshold < 97 ? 'SKIPPED' : 'CANCELLED');
}

export function generateRandomDB() {
    const workflows = Array(20).fill(null).map(
        () => {
            const name = uniqueNamesGenerator({dictionaries: [adjectives]});
            const num = Math.round(Math.random()*45);
            return {
                name: name,
                nRuns: num
            }
        }
    )

    const db : {
        [workflowName: string]: {
            id: number, 
            name?: string,
            run?: StateFile,
        }[],
        
    } = {};

    const index : {
        id: number,
        name: string,
    }[] = [];

    workflows.forEach(workflow => {
        const runs : StateFile[] = []
        for (let i = 0; i < workflow.nRuns; i++) {
            runs.push(randomStateFile(workflow.name, i))
        }
        index.push({
            id: index.length,
            name: workflow.name
        })
        const tmp : {id:number, run:StateFile}[] = []
        let count : number;
        count = 0;
        runs.forEach(run => {
            tmp.push(
                {
                    id: count++,
                    run: run
                }
                )
            })
        db[workflow.name] = tmp;
        db['index'] = index;
    });
    console.log(db)

    //exportData(db)
}
