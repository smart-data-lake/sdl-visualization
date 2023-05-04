import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Line, LineChart } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';

const HistoryAreaChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;

    return (
            <ResponsiveContainer height={140}>
              <LineChart
                data={data}
                >
                {/* <YAxis tickFormatter={(value) => formatDuration(value)}/> */}
                {/* <Tooltip /> */}
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#065bbf" 
                    fill="#096bde" 
                    isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryAreaChart;