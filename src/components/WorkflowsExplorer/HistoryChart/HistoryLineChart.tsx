import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Line, LineChart, ReferenceArea, Brush } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { Indices } from '../Workflow/WorkflowHistory';

const HistoryLineChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[], indices: Indices}) => {
    const { data, indices } = props;

    return (
            <ResponsiveContainer height={160}>
              <LineChart
                data={data}
                >
                  <Brush height={20}/>
                <Tooltip
                  position={{ y: 10 }}
                  animationDuration={100} 
                  labelFormatter={(value: string) => {
                      if (data.length > parseInt(value)) return `Run ${data[value].runId} attempt ${data[value].attemptId}`
                    }
                  }
                  formatter={(value: number, name: string) => {return [formatDuration(value) as any, 'Duration']}}
                />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#096bde" 
                    fill= "#096bde"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    />
                {/* <ReferenceArea x1={indices.toDisplayLeft} x2={indices?.toDisplayRight} stroke="blue" strokeOpacity={0.5} />
                <ReferenceArea x1={indices.rangeLeft} x2={indices?.rangeRight}/> */}
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryLineChart;