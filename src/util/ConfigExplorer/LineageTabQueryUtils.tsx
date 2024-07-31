import neo4j, { Session } from 'neo4j-driver'; // TODO: refactor this to App
import { DataOrActionObject } from './LineageTabUtils';


const driver = neo4j.driver('neo4j://localhost', neo4j.auth.basic('username', 'password'));

/*
    Query is a neo4j query
    session is the neo4j session
*/
function getQueryResult(query: string, session: Session){
    session.run(query)
    .then(result => {
      result.records.forEach(record => {
        console.log(record.get('n'));
      });
    })
    .catch(error => {
      console.error('Error:', error);
    })
    .finally(() => {
      session.close();
      driver.close();
    });
}


/*
  use neo4j server to query the lineage graph and map the result back to DAGraph, then to ReactFlow Elements...
*/
export function groupByFeedName(session: Session){
    const query = '...';
    return getQueryResult(query, session);
}


const fetchGraphData = async (groupingFunc) => {
    const session = driver.session();
    const resultData: DataOrActionObject[] = [];
  
    try {
      const result = await groupingFunc(session);
      
      result.records.forEach(record => {
        const node: DataOrActionObject = record.get('...');
        resultData.push(node);
      });
    } catch (error) {
      console.error('Query Error:', error);
    } finally {
      await session.close();
    }
  
    return resultData;
};

