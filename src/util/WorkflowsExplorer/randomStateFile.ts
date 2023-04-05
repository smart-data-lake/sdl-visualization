import { ActionsState, Action, StateFile } from "../types"
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
    const randomCoin = Math.round(Math.random());
    const action : Action = {
        executionId: {
            type : uniqueNamesGenerator({ dictionaries: [languages] }),
            runId : Math.round(Math.random() * 1000),
            attemptId : Math.round(Math.random() * 1000),
        },
        state : randomState(),
        startTstmp : new Date(runStartTime.getTime() + Math.round(Math.random() * 50000) + 100).toISOString(),
        duration : 'PT' + (Math.random() * 60).toFixed(3) + 'S',
        results : [{
            subFeed : randomCoin > 0 ? {
                type : randomCoin > 0 ? uniqueNamesGenerator({ dictionaries: [languages] }) : undefined,
                dataObjectId : randomCoin > 0 ? uniqueNamesGenerator({ dictionaries: [countries] }) : undefined,
                partitionValues : randomCoin > 0 ? [uniqueNamesGenerator({ dictionaries: [animals] })] : [],
                isDAGStart : randomCoin > 0 ? true : false,
                isSkipped : randomCoin > 0 ? true : false,
                isDummy : randomCoin > 0 ? true : false,

            } : undefined,
            mainMetrics : randomCoin > 0 ? {
                stage : randomCoin > 0 ? uniqueNamesGenerator({ dictionaries: [starWars] }) : undefined,
                num_tasks : randomCoin > 0 ? uniqueNamesGenerator({ dictionaries: [languages] }) : undefined,
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

/* const exportData = (data: any) => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(data)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "data.json";

    link.click();
}; */