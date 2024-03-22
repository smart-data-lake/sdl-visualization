## About this component
The timeline component was extracted by @zzeekk from the open-source project Metaflow UI [https://github.com/Netflix/metaflow-ui]. 

It was slightly modified by @entouanes to model better the data format from SDLB statefiles, in order to display "actions" in a "run" as "Metaflow tasks". The concept of "steps" present in metaflow-ui was completely removed as it doesn't represent anything in SDLB. 

They types of the original metaflow-ui were also rewritten in an effort to simplify the translation (happening in "src/util/WorkflowsExplorer/Attempt.ts") between statefiles' ActionsStates and metaflow's task. The file "src/types.ts" contains these modified types.

"Metaflow UI is licensed under Apache-2.0 license. The corresponding license file is provided in this folder."